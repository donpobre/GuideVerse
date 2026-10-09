import logging
import logging
import asyncio
import html
import secrets
import smtplib
from email.message import EmailMessage
from urllib.parse import urlencode

from uuid import UUID

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Annotated

import httpx
import stripe
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .database import get_session

logger = logging.getLogger(__name__)
from .repositories import AuthRepository, ExperienceRepository, ProviderOperationsRepository, ProviderRepository
from .schemas import AvailabilityUpdate, BidCreate, ExperienceCreate, ExperienceCreated, ExperienceOut, ForgotPasswordSchema, InstantAvailabilityUpdate, LoginSchema, MessageCreate, PayoutSettingsUpdate, ProviderExperienceListItem, ProviderProfileUpdate, SearchResponse, SignupSchema

logging.basicConfig(level=logging.INFO)
settings = get_settings()
app = FastAPI(title="GuideVerse API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


@app.get("/api/public/categories")
async def get_public_categories(session: AsyncSession = Depends(get_session)):
    # Simple hardcoded fallback or DB query for categories
    result = await session.execute(text("SELECT name FROM provider_categories ORDER BY display_order ASC"))
    return [row[0] for row in result.all()]

@app.get("/api/public/providers")
async def get_public_providers(session: AsyncSession = Depends(get_session)):
    query = text("""
        SELECT p.id, p.public_slug, p.business_name, p.bio, p.base_address, u.first_name, u.last_name, u.avatar_url, ts.trust_score, ts.total_reviews 
        FROM providers p 
        JOIN users u ON p.user_id = u.id 
        LEFT JOIN trust_scores ts ON p.id = ts.provider_id 
        WHERE p.onboarding_status='approved' OR p.onboarding_status='pending' LIMIT 6
    """)
    result = await session.execute(query)
    providers = []
    for row in result.mappings():
        providers.append({
            "id": str(row["id"]),
            "public_slug": row["public_slug"] or str(row["id"]),
            "name": row["business_name"] or f"{row['first_name']} {row['last_name']}",
            "image": row["avatar_url"],
            "videoThumb": row["avatar_url"], # fallback to image if no video
            "trustScore": float(row["trust_score"]) if row["trust_score"] else 0.0,
            "subtype": "Local Expert",
            "location": row["base_address"],
            "verified": True,
            "availableNow": True
        })
    return providers

@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/login")
async def login(payload: LoginSchema, session: AsyncSession = Depends(get_session)) -> dict:
    user = await AuthRepository(session).login(payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"status": "authenticated", "user": user}


@app.post("/api/auth/signup", status_code=201)
async def signup(payload: SignupSchema, session: AsyncSession = Depends(get_session)) -> dict:
    try:
        user = await AuthRepository(session).signup(payload.name, payload.email, payload.password, payload.role, payload.business_name, payload.bio)
        return {"status": "created", "user": user}
    except Exception as error:
        await session.rollback()
        if "users_email_key" in str(error) or "unique" in str(error).lower():
            raise HTTPException(status_code=409, detail="An account with that email already exists") from error
        raise


@app.post("/api/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordSchema, session: AsyncSession = Depends(get_session)) -> dict:
    token = await AuthRepository(session).create_password_reset(payload.email)
    result={"status":"reset_sent","message":"If that email is registered, password reset instructions are available."}
    if token and settings.app_env=="development": result["reset_url"]=f"{settings.frontend_url}/auth?reset_token={token}"
    return result

@app.post("/api/auth/reset-password")
async def reset_password(payload: dict, session: AsyncSession = Depends(get_session)) -> dict:
    token=str(payload.get("token","")).strip(); password=str(payload.get("password", ""))
    if len(password)<8: raise HTTPException(422,"Password must be at least 8 characters")
    if not await AuthRepository(session).reset_password(token,password): raise HTTPException(400,"Reset link is invalid or expired")
    return {"status":"password_updated","message":"Password updated. You can now sign in."}

def oauth_credentials(provider: str) -> tuple[str | None,str | None]:
    if provider=="google": return settings.google_client_id,settings.google_client_secret
    if provider=="facebook": return settings.facebook_client_id,settings.facebook_client_secret
    raise HTTPException(400,"Unsupported OAuth provider")

@app.get("/api/auth/oauth/providers")
async def oauth_providers() -> dict:
    return {name:{"configured":bool(all(oauth_credentials(name)))} for name in ("google","facebook")}


@app.post("/api/auth/oauth/{provider}")
async def oauth_login(provider: str, session: AsyncSession = Depends(get_session)) -> dict:
    client_id,client_secret=oauth_credentials(provider)
    if not client_id or not client_secret: raise HTTPException(503,f"{provider.title()} login is not configured yet")
    state=secrets.token_urlsafe(32); await session.execute(text("INSERT INTO oauth_states(state_token,provider,expires_at) VALUES(:state,:provider,CURRENT_TIMESTAMP+INTERVAL '10 minutes')"),{"state":state,"provider":provider}); await session.commit()
    callback=f"{settings.backend_url}/api/auth/oauth/{provider}/callback"
    if provider=="google": url="https://accounts.google.com/o/oauth2/v2/auth?"+urlencode({"client_id":client_id,"redirect_uri":callback,"response_type":"code","scope":"openid email profile","state":state,"prompt":"select_account"})
    else: url="https://www.facebook.com/v23.0/dialog/oauth?"+urlencode({"client_id":client_id,"redirect_uri":callback,"response_type":"code","scope":"email,public_profile","state":state})
    return {"authorization_url":url}

@app.get("/api/auth/oauth/{provider}/callback",include_in_schema=False)
async def oauth_callback(provider: str, code: str, state: str, session: AsyncSession = Depends(get_session)):
    client_id,client_secret=oauth_credentials(provider); valid=(await session.execute(text("DELETE FROM oauth_states WHERE state_token=:state AND provider=:provider AND expires_at>CURRENT_TIMESTAMP RETURNING state_token"),{"state":state,"provider":provider})).scalar_one_or_none()
    if not valid: return RedirectResponse(f"{settings.frontend_url}/auth?oauth_error=invalid_state")
    callback=f"{settings.backend_url}/api/auth/oauth/{provider}/callback"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            if provider=="google":
                token_response=await client.post("https://oauth2.googleapis.com/token",data={"client_id":client_id,"client_secret":client_secret,"code":code,"grant_type":"authorization_code","redirect_uri":callback}); token_response.raise_for_status(); access=token_response.json()["access_token"]
                profile_response=await client.get("https://openidconnect.googleapis.com/v1/userinfo",headers={"Authorization":f"Bearer {access}"}); profile_response.raise_for_status(); profile=profile_response.json(); oauth_id=profile["sub"]
            else:
                token_response=await client.get("https://graph.facebook.com/v23.0/oauth/access_token",params={"client_id":client_id,"client_secret":client_secret,"code":code,"redirect_uri":callback}); token_response.raise_for_status(); access=token_response.json()["access_token"]
                profile_response=await client.get("https://graph.facebook.com/me",params={"fields":"id,name,first_name,last_name,email,picture","access_token":access}); profile_response.raise_for_status(); profile=profile_response.json(); oauth_id=profile["id"]
        email=profile.get("email")
        if not email: raise ValueError("Provider did not return an email")
        user=(await session.execute(text("""INSERT INTO users(email,first_name,last_name,avatar_url,primary_role,account_status,oauth_provider,provider_oauth_id)
          VALUES(:email,:first,:last,:avatar,'pending','active',:provider,:oauth_id) ON CONFLICT(email) DO UPDATE SET oauth_provider=:provider,provider_oauth_id=:oauth_id,avatar_url=COALESCE(EXCLUDED.avatar_url,users.avatar_url)
          RETURNING id"""),{"email":email.lower(),"first":profile.get("given_name") or profile.get("first_name") or profile.get("name","Traveler").split()[0],"last":profile.get("family_name") or profile.get("last_name") or "","avatar":profile.get("picture") if isinstance(profile.get("picture"),str) else profile.get("picture",{}).get("data",{}).get("url"),"provider":provider,"oauth_id":oauth_id})).mappings().one()
        login_token=secrets.token_urlsafe(40); await session.execute(text("INSERT INTO auth_login_tokens(login_token,user_id,expires_at) VALUES(:token,:user,CURRENT_TIMESTAMP+INTERVAL '5 minutes')"),{"token":login_token,"user":user["id"]}); await session.commit()
        return RedirectResponse(f"{settings.frontend_url}/auth?login_token={login_token}")
    except Exception:
        logger.exception("OAuth callback failed for provider %s", provider)
        await session.rollback(); return RedirectResponse(f"{settings.frontend_url}/auth?oauth_error=provider_failed")

@app.post("/api/auth/oauth/exchange")
async def oauth_exchange(payload: dict, session: AsyncSession = Depends(get_session)) -> dict:
    token=str(payload.get("token","")).strip(); row=(await session.execute(text("""UPDATE auth_login_tokens SET used_at=CURRENT_TIMESTAMP WHERE login_token=:token AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP
      RETURNING user_id"""),{"token":token})).mappings().one_or_none()
    if row is None: raise HTTPException(401,"Social login token is invalid or expired")
    user=(await session.execute(text("SELECT id,email,first_name,last_name,primary_role,avatar_url,account_status FROM users WHERE id=:id"),{"id":row["user_id"]})).mappings().one(); await session.commit()
    result={"status":"authenticated","user":dict(user),"needs_role":user["primary_role"]=="pending"}
    if result["needs_role"]:
        role_token=secrets.token_urlsafe(40); await session.execute(text("INSERT INTO auth_role_tokens(role_token,user_id,expires_at) VALUES(:token,:user,CURRENT_TIMESTAMP+INTERVAL '15 minutes')"),{"token":role_token,"user":user["id"]}); await session.commit(); result["role_token"]=role_token
    return result

@app.post("/api/auth/complete-role")
async def complete_oauth_role(payload: dict, session: AsyncSession = Depends(get_session)) -> dict:
    role=str(payload.get("role","")).lower(); token=str(payload.get("token","")).strip()
    if role not in ("traveler","provider"): raise HTTPException(422,"Choose traveler or provider")
    row=(await session.execute(text("UPDATE auth_role_tokens SET used_at=CURRENT_TIMESTAMP WHERE role_token=:token AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP RETURNING user_id"),{"token":token})).mappings().one_or_none()
    if row is None: raise HTTPException(401,"Role setup link is invalid or expired")
    user=(await session.execute(text("UPDATE users SET primary_role=:role,updated_at=CURRENT_TIMESTAMP WHERE id=:id AND primary_role='pending' RETURNING id,email,first_name,last_name,primary_role,avatar_url,account_status"),{"role":role,"id":row["user_id"]})).mappings().one_or_none()
    if user is None: raise HTTPException(409,"Account role has already been selected")
    if role=="provider":
        provider=(await session.execute(text("INSERT INTO providers(user_id,business_name,bio) VALUES(:user,:business,'') ON CONFLICT(user_id) DO UPDATE SET updated_at=CURRENT_TIMESTAMP RETURNING id"),{"user":user["id"],"business":f"{user['first_name']} {user['last_name']} Experiences"})).mappings().one(); await session.execute(text("INSERT INTO provider_trust_scores(provider_id) VALUES(:id) ON CONFLICT DO NOTHING"),{"id":provider["id"]})
    await session.commit(); return {"status":"authenticated","user":dict(user)}



@app.get("/api/search/experiences", response_model=SearchResponse)
async def search_experiences(
    q: str | None = Query(default=None, max_length=200),
    category: Annotated[list[str] | None, Query()] = None,
    min_price: Decimal | None = Query(default=None, ge=0),
    max_price: Decimal | None = Query(default=None, ge=0),
    rating: Decimal | None = Query(default=None, ge=0, le=5),
    language: Annotated[list[str] | None, Query()] = None,
    group_type: str | None = Query(default=None, pattern="^(private|group)$"),
    instant: bool | None = Query(default=None),
    themes: Annotated[list[str] | None, Query()] = None,
    time_of_day: Annotated[list[str] | None, Query()] = None,
    activity_level: Annotated[list[str] | None, Query()] = None,
    is_accessible: bool | None = Query(default=None),
    min_travelers: int | None = Query(default=None, ge=1),
    max_travelers: int | None = Query(default=None, ge=1),
    duration_bucket: Annotated[list[str] | None, Query()] = None,
    date_start: date | None = None, date_end: date | None = None,
    sort: str = Query(default="recommended", pattern="^(recommended|price_asc|price_desc|rating|popular)$"),
    page: int = Query(default=1, ge=1), page_size: int = Query(default=6, ge=1, le=48),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status_code=422, detail="Minimum price cannot exceed maximum price")
    if min_travelers is not None and max_travelers is not None and min_travelers > max_travelers:
        raise HTTPException(status_code=422, detail="Minimum travelers cannot exceed maximum travelers")
    if date_start and date_end and date_start > date_end:
        raise HTTPException(status_code=422, detail="Start date cannot be after end date")
    return await ExperienceRepository(session).search(query=q, categories=category or [], min_price=min_price,
        max_price=max_price, rating=rating, languages=language or [], date_start=date_start,
        date_end=date_end, group_type=group_type, instant=instant, themes=themes or [],
        time_of_day=time_of_day or [], activity_level=activity_level or [], is_accessible=is_accessible,
        min_travelers=min_travelers, max_travelers=max_travelers, duration_bucket=duration_bucket or [],
        sort=sort, page=page, page_size=page_size)


@app.get("/api/experiences/{identifier}", response_model=ExperienceOut)
async def get_experience(
    identifier: str,
    session: AsyncSession = Depends(get_session),
) -> dict:
    experience = await ExperienceRepository(session).get_published(identifier)
    if experience is None:
        raise HTTPException(status_code=404, detail="Experience not found")
    return experience


@app.get("/api/providers/{identifier}")
async def get_public_provider(identifier: str, session: AsyncSession = Depends(get_session)) -> dict:
    if identifier == "dashboard" or identifier == "profile":
        raise HTTPException(status_code=404, detail="Provider not found")
    profile = await ProviderRepository(session).get_public(identifier)
    if profile is None: raise HTTPException(status_code=404, detail="Provider not found")
    return profile



async def current_provider_id(x_user_id: str | None = Header(default=None), x_provider_id: str | None = Header(default=None), session: AsyncSession = Depends(get_session)) -> UUID:
    if x_user_id:
        try: user_id = UUID(x_user_id)
        except ValueError as error: raise HTTPException(status_code=401, detail="Invalid user identity") from error
        provider_id = await session.scalar(text("SELECT id FROM providers WHERE user_id=:user_id"), {"user_id": user_id})
        if provider_id is None: raise HTTPException(status_code=403, detail="This account does not have a provider profile")
        return provider_id
    raw_id = x_provider_id or (settings.dev_provider_id if settings.app_env == "development" else None)
    if not raw_id:
        raise HTTPException(status_code=401, detail="Provider authentication is required")
    try:
        return UUID(raw_id)
    except ValueError as error:
        raise HTTPException(status_code=401, detail="Invalid provider identity") from error

def current_user_id(x_user_id: str | None = Header(default=None)) -> UUID:
    if not x_user_id: raise HTTPException(status_code=401, detail="Sign in is required")
    try: return UUID(x_user_id)
    except ValueError as error: raise HTTPException(status_code=401, detail="Invalid user identity") from error

async def current_admin_id(user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> UUID:
    role = await session.scalar(text("SELECT primary_role FROM users WHERE id=:id"), {"id": user_id})
    if role != "admin": raise HTTPException(status_code=403, detail="Administrator access is required")
    return user_id

@app.get("/api/traveler/settings")
async def traveler_settings(user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    user = (await session.execute(text("SELECT id,first_name,last_name,email,phone,avatar_url,account_status FROM users WHERE id=:id"), {"id":user_id})).mappings().one_or_none()
    if user is None: raise HTTPException(404, "Traveler not found")
    prefs = (await session.execute(text("SELECT booking,messages,safety,promotions FROM traveler_notification_preferences WHERE user_id=:id"), {"id":user_id})).mappings().one_or_none()
    contacts = (await session.execute(text("SELECT id,name,phone FROM traveler_emergency_contacts WHERE user_id=:id ORDER BY created_at"), {"id":user_id})).mappings().all()
    payments = (await session.execute(text("SELECT id,provider,brand,last4,expiry_month,expiry_year,display_label FROM traveler_payment_methods WHERE user_id=:id ORDER BY created_at"), {"id":user_id})).mappings().all()
    return {"profile":dict(user),"notifications":dict(prefs or {"booking":True,"messages":True,"safety":True,"promotions":False}),"contacts":[dict(x) for x in contacts],"payment_methods":[dict(x) for x in payments]}

def paypal_api_base() -> str:
    return "https://api-m.paypal.com" if settings.paypal_env == "live" else "https://api-m.sandbox.paypal.com"

async def paypal_access_token() -> str:
    if not settings.paypal_client_id or not settings.paypal_client_secret:
        raise HTTPException(503, "PayPal sandbox is not configured yet")
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(f"{paypal_api_base()}/v1/oauth2/token", data={"grant_type":"client_credentials"}, auth=(settings.paypal_client_id, settings.paypal_client_secret))
    if response.is_error: raise HTTPException(502, "PayPal authentication failed")
    return response.json()["access_token"]

@app.get("/api/traveler/payment-methods/providers")
async def payment_provider_status(user_id: UUID = Depends(current_user_id)) -> dict:
    return {"stripe":{"configured":bool(settings.stripe_secret_key)},"paypal":{"configured":bool(settings.paypal_client_id and settings.paypal_client_secret),"environment":settings.paypal_env}}

async def experience_checkout_record(identifier: str, session: AsyncSession):
    try: experience_id=UUID(identifier)
    except ValueError: experience_id=None
    row=(await session.execute(text("""SELECT e.id,e.provider_id,e.title,e.slug,e.base_price,e.currency,e.duration_minutes,e.max_capacity,e.meeting_address
      FROM experiences e WHERE (e.id=:id OR e.slug=:slug) AND e.is_published=TRUE"""),{"id":experience_id,"slug":identifier})).mappings().one_or_none()
    if row is None: raise HTTPException(404,"Experience not found")
    return row

async def checkout_amount(experience_id: UUID, guests: int, base_price: Decimal, session: AsyncSession) -> Decimal:
    groups=(await session.execute(text("SELECT number_of_person,base_price FROM experience_price_group WHERE experience_id=:id"),{"id":experience_id})).mappings().all()
    for group in groups:
        numbers=[int(value) for value in __import__('re').findall(r"\d+",group["number_of_person"])]
        if (len(numbers)==1 and guests==numbers[0]) or (len(numbers)>1 and numbers[0]<=guests<=numbers[1]): return Decimal(group["base_price"])*guests
    return Decimal(base_price)*guests

async def service_fee_rate(session: AsyncSession) -> Decimal:
    value=(await session.execute(text("SELECT setting_value FROM platform_settings WHERE setting_key='service_fee_rate'"))).scalar_one_or_none()
    try: rate=Decimal(value or "0.04")
    except Exception: rate=Decimal("0.04")
    return min(max(rate,Decimal("0")),Decimal("1"))

@app.get("/api/admin/platform-config")
async def get_platform_config(user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> dict:
    rate=await service_fee_rate(session)
    return {"service_fee_rate":rate,"service_fee_percent":rate*100}

@app.put("/api/admin/platform-config")
async def update_platform_config(payload: dict, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> dict:
    try: percent=Decimal(str(payload.get("service_fee_percent")))
    except Exception as error: raise HTTPException(422,"Enter a valid service fee percentage") from error
    if percent<0 or percent>100: raise HTTPException(422,"Service fee must be between 0% and 100%")
    rate=(percent/100).quantize(Decimal("0.0001"))
    await session.execute(text("""INSERT INTO platform_settings(setting_key,setting_value,updated_by) VALUES('service_fee_rate',:value,:user)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_by=EXCLUDED.updated_by,updated_at=CURRENT_TIMESTAMP"""),{"value":str(rate),"user":user_id}); await session.commit()
    return {"service_fee_rate":rate,"service_fee_percent":rate*100}

@app.get("/api/public/tour-locations")
async def get_public_tour_locations(session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows = (await session.execute(text("SELECT id,name FROM tour_locations ORDER BY display_order,name"))).mappings().all()
    return [{"id": str(row["id"]), "name": row["name"]} for row in rows]

@app.get("/api/admin/tour-locations")
async def get_admin_tour_locations(user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows = (await session.execute(text("SELECT id,name,display_order,created_at,updated_at FROM tour_locations ORDER BY display_order,name"))).mappings().all()
    return [dict(row) for row in rows]

@app.post("/api/admin/tour-locations", status_code=201)
async def create_admin_tour_location(payload: dict, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> dict:
    name = str(payload.get("name") or "").strip()
    if not name: raise HTTPException(422, "Enter a tour location")
    try:
        row = (await session.execute(text("""INSERT INTO tour_locations(name,display_order,updated_by)
          VALUES(:name,COALESCE((SELECT MAX(display_order)+1 FROM tour_locations),1),:user)
          RETURNING id,name,display_order,created_at,updated_at"""), {"name": name, "user": user_id})).mappings().one()
        await session.commit()
    except Exception as error:
        await session.rollback()
        if "unique" in str(error).lower(): raise HTTPException(409, "That tour location already exists") from error
        raise
    return dict(row)

@app.put("/api/admin/tour-locations/{location_id}")
async def update_admin_tour_location(location_id: UUID, payload: dict, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> dict:
    name = str(payload.get("name") or "").strip()
    if not name: raise HTTPException(422, "Enter a tour location")
    try:
        row = (await session.execute(text("""UPDATE tour_locations SET name=:name,updated_by=:user,updated_at=CURRENT_TIMESTAMP
          WHERE id=:id RETURNING id,name,display_order,created_at,updated_at"""), {"id": location_id, "name": name, "user": user_id})).mappings().one_or_none()
        if row is None: raise HTTPException(404, "Tour location not found")
        await session.commit()
    except HTTPException: raise
    except Exception as error:
        await session.rollback()
        if "unique" in str(error).lower(): raise HTTPException(409, "That tour location already exists") from error
        raise
    return dict(row)

@app.delete("/api/admin/tour-locations/{location_id}", status_code=204)
async def delete_admin_tour_location(location_id: UUID, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> None:
    deleted = await session.execute(text("DELETE FROM tour_locations WHERE id=:id RETURNING id"), {"id": location_id})
    if deleted.scalar_one_or_none() is None: raise HTTPException(404, "Tour location not found")
    await session.commit()

@app.get("/api/admin/custom-requests")
async def admin_custom_requests(user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows=(await session.execute(text("""SELECT cr.id,cr.title,cr.destination_name,cr.start_date,cr.end_date,cr.group_size,cr.budget_max,cr.currency,cr.description,cr.group_type,cr.status,cr.created_at,
      u.email AS traveler_email,u.first_name,u.last_name,COUNT(cb.id) AS proposal_count
      FROM custom_requests cr JOIN users u ON u.id=cr.traveler_id LEFT JOIN custom_request_bids cb ON cb.request_id=cr.id
      GROUP BY cr.id,u.email,u.first_name,u.last_name ORDER BY cr.created_at DESC"""))).mappings().all()
    return [dict(row) for row in rows]

@app.delete("/api/admin/custom-requests/{request_id}", status_code=204)
async def admin_delete_custom_request(request_id: UUID, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> None:
    deleted=await session.execute(text("DELETE FROM custom_requests WHERE id=:id RETURNING id"), {"id": request_id})
    if deleted.scalar_one_or_none() is None: raise HTTPException(status_code=404, detail="Custom request not found")
    await session.commit()

@app.post("/api/admin/custom-requests/{request_id}/close", status_code=204)
async def admin_close_custom_request(request_id: UUID, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> None:
    result=await session.execute(text("UPDATE custom_requests SET status='closed' WHERE id=:id RETURNING id"),{"id":request_id})
    if result.scalar_one_or_none() is None: raise HTTPException(404,"Custom request not found")
    await session.commit()

@app.post("/api/admin/custom-requests/{request_id}/proposals/{proposal_id}/hide", status_code=204)
async def admin_hide_custom_proposal(request_id: UUID, proposal_id: UUID, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> None:
    result=await session.execute(text("UPDATE custom_request_bids SET is_hidden=TRUE WHERE id=:proposal AND request_id=:request RETURNING id"),{"proposal":proposal_id,"request":request_id})
    if result.scalar_one_or_none() is None: raise HTTPException(404,"Proposal not found")
    await session.commit()

@app.get("/api/admin/custom-requests/{request_id}")
async def admin_custom_request_detail(request_id: UUID, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> dict:
    request_row=(await session.execute(text("""SELECT cr.*,u.email AS traveler_email,u.first_name AS traveler_first_name,u.last_name AS traveler_last_name
      FROM custom_requests cr JOIN users u ON u.id=cr.traveler_id WHERE cr.id=:id"""),{"id":request_id})).mappings().one_or_none()
    if request_row is None: raise HTTPException(404,"Custom request not found")
    bids=(await session.execute(text("""SELECT cb.id,cb.request_id,cb.provider_id,cb.quoted_price,cb.currency,cb.proposed_itinerary,cb.portfolio_experience_id,cb.status,cb.created_at,
      cb.created_at AS updated_at,p.business_name AS provider_name,p.public_slug,COALESCE(pts.average_rating,0) AS rating,
      (SELECT COUNT(*) FROM custom_request_bid_messages m WHERE m.bid_id=cb.id) AS message_count,
       (SELECT COUNT(*) FROM custom_request_bid_messages m WHERE m.bid_id=cb.id AND m.read_at IS NULL AND m.sender_user_id<>:user) AS unread_provider_message_count,
      (SELECT MAX(m.created_at) FROM custom_request_bid_messages m WHERE m.bid_id=cb.id) AS last_message_at
      FROM custom_request_bids cb JOIN providers p ON p.id=cb.provider_id LEFT JOIN provider_trust_scores pts ON pts.provider_id=p.id
      WHERE cb.request_id=:id ORDER BY cb.created_at"""),{"id":request_id})).mappings().all()
    result=[]
    for bid in bids:
        messages=(await session.execute(text("""SELECT m.id,m.sender_user_id,m.body,m.created_at,u.first_name,u.last_name
          FROM custom_request_bid_messages m JOIN users u ON u.id=m.sender_user_id WHERE m.bid_id=:bid ORDER BY m.created_at"""),{"bid":bid["id"]})).mappings().all()
        result.append({**dict(bid),"messages":[dict(message) for message in messages]})
    return {"request":dict(request_row),"proposals":result}

@app.get("/api/traveler/checkout/{identifier}")
async def checkout_quote(identifier: str, date: date = Query(), guests: int = Query(ge=1), booking_id: UUID | None = Query(default=None), user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    if date < datetime.now(timezone.utc).date(): raise HTTPException(422,"Choose a future date")
    exp=await experience_checkout_record(identifier,session)
    if guests>exp["max_capacity"]: raise HTTPException(422,f"Maximum group size is {exp['max_capacity']}")
    subtotal=await checkout_amount(exp["id"],guests,exp["base_price"],session); rate=await service_fee_rate(session); fee=(subtotal*rate).quantize(Decimal("0.01")); total=subtotal+fee
    if booking_id:
        approved=(await session.execute(text("SELECT gross_amount,platform_fee,net_provider_payout FROM bookings WHERE id=:id AND traveler_id=:user AND experience_id=:experience AND status='pending_payment'"),{"id":booking_id,"user":user_id,"experience":exp["id"]})).mappings().one_or_none()
        if approved:
            total=Decimal(approved["gross_amount"]); fee=Decimal(approved["platform_fee"]); subtotal=Decimal(approved["net_provider_payout"])
    methods=(await session.execute(text("SELECT id,provider,brand,last4,expiry_month,expiry_year,display_label FROM traveler_payment_methods WHERE user_id=:user ORDER BY created_at"),{"user":user_id})).mappings().all()
    return {"experience":dict(exp),"date":date.isoformat(),"guests":guests,"subtotal":subtotal,"service_fee_rate":rate,"service_fee_percent":rate*100,"service_fee":fee,"total":total,"currency":exp["currency"],"payment_methods":[dict(x) for x in methods],"providers":{"stripe":bool(settings.stripe_secret_key),"paypal":bool(settings.paypal_client_id and settings.paypal_client_secret)}}

@app.post("/api/traveler/checkout/{identifier}/pay")
async def start_checkout_payment(identifier: str, payload: dict, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    try: travel_date=date.fromisoformat(str(payload.get("date"))); guests=int(payload.get("guests",0))
    except (ValueError,TypeError): raise HTTPException(422,"Choose a valid date and group size")
    provider=str(payload.get("provider","")).lower()
    if provider not in ("stripe","paypal"): raise HTTPException(422,"Choose Stripe or PayPal")
    exp=await experience_checkout_record(identifier,session)
    if travel_date<datetime.now(timezone.utc).date() or guests<1 or guests>exp["max_capacity"]: raise HTTPException(422,"Invalid booking date or group size")
    approved_id=payload.get("booking_id")
    approved=None
    if approved_id:
        approved=(await session.execute(text("SELECT id,gross_amount,platform_fee,net_provider_payout FROM bookings WHERE id=:id AND traveler_id=:user AND experience_id=:experience AND status='pending_payment'"),{"id":approved_id,"user":user_id,"experience":exp["id"]})).mappings().one_or_none()
    subtotal=await checkout_amount(exp["id"],guests,exp["base_price"],session); rate=await service_fee_rate(session); fee=(subtotal*rate).quantize(Decimal("0.01")); total=subtotal+fee
    if approved:
        total=Decimal(approved["gross_amount"]); fee=Decimal(approved["platform_fee"]); subtotal=Decimal(approved["net_provider_payout"])
    start=datetime.combine(travel_date,time(9,0),tzinfo=timezone.utc); end=start+timedelta(minutes=exp["duration_minutes"] or 60); reference=f"GV-{secrets.token_hex(5).upper()}"
    if approved:
        booking=approved
    else:
        booking=(await session.execute(text("""INSERT INTO bookings(booking_reference,traveler_id,provider_id,experience_id,title,start_time,end_time,participant_count,gross_amount,platform_fee,net_provider_payout,currency,status)
          VALUES(:ref,:traveler,:provider,:experience,:title,:start,:end,:guests,:gross,:fee,:net,:currency,'pending_payment') RETURNING id"""),{"ref":reference,"traveler":user_id,"provider":exp["provider_id"],"experience":exp["id"],"title":exp["title"],"start":start,"end":end,"guests":guests,"gross":total,"fee":fee,"net":subtotal,"currency":exp["currency"]})).mappings().one()
    booking_id=booking["id"]
    try:
        if provider=="stripe":
            if not settings.stripe_secret_key: raise HTTPException(503,"Stripe sandbox is not configured yet")
            stripe.api_key=settings.stripe_secret_key
            checkout=stripe.checkout.Session.create(mode="payment",line_items=[{"price_data":{"currency":exp["currency"].lower(),"product_data":{"name":exp["title"]},"unit_amount":int(total*100)},"quantity":1}],success_url=f"{settings.frontend_url}/app/traveler/checkout/{exp['id']}?date={travel_date}&guests={guests}&booking={booking_id}&payment=stripe-return&session_id={{CHECKOUT_SESSION_ID}}",cancel_url=f"{settings.frontend_url}/app/traveler/checkout/{exp['id']}?date={travel_date}&guests={guests}&payment=cancelled",metadata={"booking_id":str(booking_id)})
            external=checkout.id; redirect=checkout.url
        else:
            access=await paypal_access_token(); order_payload={"intent":"CAPTURE","purchase_units":[{"reference_id":str(booking_id),"custom_id":str(booking_id),"description":exp["title"],"amount":{"currency_code":exp["currency"],"value":f"{total:.2f}"}}],"payment_source":{"paypal":{"experience_context":{"return_url":f"{settings.frontend_url}/app/traveler/checkout/{exp['id']}?date={travel_date}&guests={guests}&booking={booking_id}&payment=paypal-return","cancel_url":f"{settings.frontend_url}/app/traveler/checkout/{exp['id']}?date={travel_date}&guests={guests}&payment=cancelled","user_action":"PAY_NOW"}}}}
            async with httpx.AsyncClient(timeout=20) as client: response=await client.post(f"{paypal_api_base()}/v2/checkout/orders",json=order_payload,headers={"Authorization":f"Bearer {access}","Content-Type":"application/json","PayPal-Request-Id":secrets.token_hex(16)})
            if response.is_error: raise HTTPException(502,"PayPal checkout could not be started")
            result=response.json(); external=result["id"]; redirect=next((link["href"] for link in result.get("links",[]) if link.get("rel")=="payer-action"),None)
            if not redirect: raise HTTPException(502,"PayPal did not return an approval link")
        await session.execute(text("INSERT INTO booking_payments(booking_id,provider,external_payment_id,amount,currency,status) VALUES(:booking,:provider,:external,:amount,:currency,'pending')"),{"booking":booking_id,"provider":provider,"external":external,"amount":total,"currency":exp["currency"]}); await session.commit()
        return {"booking_id":booking_id,"redirect_url":redirect}
    except Exception:
        await session.rollback(); raise

async def confirm_paid_booking(booking_id: UUID, external_id: str, session: AsyncSession) -> None:
    booking_row=(await session.execute(text("UPDATE bookings SET status='confirmed' WHERE id=:id AND status='pending_payment' RETURNING booking_reference,traveler_id,provider_id,title,participant_count,gross_amount,currency,start_time,end_time"),{"id":booking_id})).mappings().one_or_none()
    booking = dict(booking_row) if booking_row else None
    await session.execute(text("UPDATE booking_payments SET status='paid',updated_at=CURRENT_TIMESTAMP WHERE booking_id=:id AND external_payment_id=:external"),{"id":booking_id,"external":external_id})
    traveler_email = None
    if booking:
        await session.execute(text("INSERT INTO escrow_ledgers(booking_id,amount_held,currency,status,release_scheduled_at) VALUES(:id,:amount,:currency,'held',:release) ON CONFLICT(booking_id) DO NOTHING"),{"id":booking_id,"amount":booking["gross_amount"],"currency":booking["currency"],"release":booking["start_time"]+timedelta(hours=24)})
        await session.execute(text("INSERT INTO conversations(traveler_id,provider_id,booking_id,subject) VALUES(:traveler,:provider,:booking,:subject)"),{"traveler":booking["traveler_id"],"provider":booking["provider_id"],"booking":booking_id,"subject":booking["title"]})
        traveler_email = (await session.execute(text("SELECT email FROM users WHERE id=:id"), {"id": booking["traveler_id"]})).scalar_one_or_none()
        booking["meeting_address"] = (await session.execute(text("SELECT meeting_address FROM experiences WHERE id=(SELECT experience_id FROM bookings WHERE id=:id)"), {"id": booking_id})).scalar_one_or_none()
    await session.commit()
    if booking and traveler_email:
        await send_booking_confirmation_email(traveler_email, booking_id, booking)

def _send_smtp_message(message: EmailMessage) -> None:
    if not settings.smtp_host or not settings.smtp_from_email:
        logger.warning("Booking confirmation email skipped: SMTP_HOST and SMTP_FROM_EMAIL are not configured")
        return
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)

async def send_booking_confirmation_email(recipient: str, booking_id: UUID, booking: dict) -> None:
    reference = html.escape(str(booking.get("booking_reference") or booking_id))
    title = html.escape(str(booking["title"]))
    currency = html.escape(str(booking["currency"]))
    amount = f"{float(booking['gross_amount']):,.2f}"
    start, end = booking["start_time"], booking["end_time"]
    date_label = f"{start.strftime('%A, %B')} {start.day}, {start.year}"
    time_label = f"{start.strftime('%I:%M %p').lstrip('0')} – {end.strftime('%I:%M %p').lstrip('0')}"
    guest_count = str(booking.get("participant_count", ""))
    meeting_point = html.escape(str(booking.get("meeting_address") or "See your booking details"))
    plain = f"Your GuideVerse booking is confirmed\n\nExperience: {booking['title']}\nBooking reference: {reference}\nDate: {date_label}\nTime: {time_label}\nGuests: {guest_count}\nMeeting point: {booking.get('meeting_address') or 'See your booking details'}\nTotal paid: {currency} {amount}\n\nThis email is formatted for printing."
    message = EmailMessage()
    message["Subject"] = f"Booking confirmed · {booking['title']} · {reference}"
    message["From"], message["To"] = settings.smtp_from_email, recipient
    message.set_content(plain)
    message.add_alternative(f"""
    <html><body style="margin:0;background:#f4f7fa;color:#142b52;font-family:Arial,sans-serif">
      <div style="max-width:680px;margin:24px auto;background:#fff;border:1px solid #dbe3ea">
        <div style="padding:28px;background:#142b52;color:#fff"><div style="font-size:12px;color:#e7cf93;text-transform:uppercase;letter-spacing:2px">Booking confirmed</div><h1 style="margin:8px 0;font-size:28px">Your experience is reserved</h1><p style="color:#dce7f0">Keep this email for your trip or print it for your records.</p></div>
        <div style="padding:24px"><p style="margin:0;color:#66788a;font-size:12px;text-transform:uppercase;letter-spacing:1px">Booking reference</p><p style="margin:6px 0 24px;font-size:20px;font-weight:bold">{reference}</p><h2 style="margin:0 0 18px;font-size:22px">{title}</h2>
          <table style="width:100%;border-collapse:collapse"><tr><td style="padding:12px 0;border-top:1px solid #dbe3ea;color:#66788a">Date</td><td style="padding:12px 0;border-top:1px solid #dbe3ea;text-align:right;font-weight:bold">{html.escape(date_label)}</td></tr><tr><td style="padding:12px 0;border-top:1px solid #dbe3ea;color:#66788a">Time</td><td style="padding:12px 0;border-top:1px solid #dbe3ea;text-align:right;font-weight:bold">{html.escape(time_label)}</td></tr><tr><td style="padding:12px 0;border-top:1px solid #dbe3ea;color:#66788a">Guests</td><td style="padding:12px 0;border-top:1px solid #dbe3ea;text-align:right;font-weight:bold">{guest_count}</td></tr><tr><td style="padding:12px 0;border-top:1px solid #dbe3ea;color:#66788a">Meeting point</td><td style="padding:12px 0;border-top:1px solid #dbe3ea;text-align:right;font-weight:bold">{meeting_point}</td></tr></table>
          <div style="margin-top:24px;padding:18px;background:#f4f7fa"><span style="color:#66788a">Total paid</span><strong style="float:right;font-size:20px">{currency} {amount}</strong></div>
        </div><div style="padding:18px 24px;border-top:1px solid #dbe3ea;color:#66788a;font-size:12px">GuideVerse · Arrive 10–15 minutes early · Printable booking confirmation</div>
      </div>
    </body></html>""", subtype="html")
    try:
        await asyncio.to_thread(_send_smtp_message, message)
    except Exception:
        logger.exception("Booking confirmation email could not be sent for booking %s", booking_id)

@app.post("/api/traveler/bookings/{booking_id}/paypal/complete")
async def complete_paypal_checkout(booking_id: UUID, payload: dict, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    order_id=str(payload.get("order_id","")).strip(); owned=(await session.execute(text("SELECT 1 FROM bookings WHERE id=:id AND traveler_id=:user"),{"id":booking_id,"user":user_id})).scalar_one_or_none()
    if not owned or not order_id: raise HTTPException(404,"Booking payment not found")
    access=await paypal_access_token()
    async with httpx.AsyncClient(timeout=20) as client: response=await client.post(f"{paypal_api_base()}/v2/checkout/orders/{order_id}/capture",headers={"Authorization":f"Bearer {access}","Content-Type":"application/json","PayPal-Request-Id":secrets.token_hex(16)})
    if response.is_error or response.json().get("status")!="COMPLETED": raise HTTPException(402,"PayPal payment was not completed")
    await confirm_paid_booking(booking_id,order_id,session); return {"booking_id":booking_id,"status":"confirmed"}

@app.post("/api/traveler/bookings/{booking_id}/stripe/complete")
async def complete_stripe_checkout(booking_id: UUID, payload: dict, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    session_id=str(payload.get("session_id","")).strip()
    owned=(await session.execute(text("SELECT 1 FROM bookings WHERE id=:id AND traveler_id=:user"),{"id":booking_id,"user":user_id})).scalar_one_or_none()
    if not owned or not session_id: raise HTTPException(404,"Booking payment not found")
    if not settings.stripe_secret_key: raise HTTPException(503,"Stripe sandbox is not configured yet")
    stripe.api_key=settings.stripe_secret_key
    try:
        checkout=stripe.checkout.Session.retrieve(session_id)
    except Exception as exc:
        logger.warning("Stripe checkout session could not be retrieved: %s", exc)
        raise HTTPException(402,"Stripe payment could not be verified") from exc
    if checkout.get("metadata",{}).get("booking_id") != str(booking_id) or checkout.get("payment_status") != "paid":
        raise HTTPException(402,"Stripe payment was not completed")
    await confirm_paid_booking(booking_id,session_id,session); return {"booking_id":booking_id,"status":"confirmed"}

@app.get("/api/traveler/bookings/{booking_id}/confirmation")
async def booking_confirmation(booking_id: UUID, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    booking = (await session.execute(text("""
        SELECT b.id, b.booking_reference, b.title, b.start_time, b.end_time,
               b.participant_count, b.gross_amount, b.platform_fee, b.net_provider_payout,
               b.currency, b.status, b.experience_id,
               e.slug AS experience_slug, e.description, e.duration_minutes,
               e.max_capacity, e.base_price, e.meeting_address,
               e.inclusions, e.exclusions, e.requirements,
               e.group_type::text AS group_type, e.activity_level::text AS activity_level,
               e.is_accessible, e.is_instant_book, e.themes, e.time_of_day,
               pc.name AS category,
               COALESCE(p.business_name, provider_user.first_name || ' ' || provider_user.last_name) AS provider_name,
               p.bio AS provider_bio, provider_user.avatar_url AS provider_avatar,
               COALESCE(pts.average_rating, 0) AS rating,
               COALESCE(pts.total_reviews, 0) AS review_count,
               bp.provider AS payment_provider, bp.external_payment_id,
               bp.status AS payment_status
        FROM bookings b
        JOIN experiences e ON e.id = b.experience_id
        JOIN provider_categories pc ON pc.id = e.category_id
        JOIN providers p ON p.id = b.provider_id
        JOIN users provider_user ON provider_user.id = p.user_id
        LEFT JOIN provider_trust_scores pts ON pts.provider_id = p.id
        LEFT JOIN booking_payments bp ON bp.booking_id = b.id
        WHERE b.id = :booking_id AND (b.traveler_id = :user_id OR p.user_id = :user_id)
        ORDER BY bp.created_at DESC NULLS LAST
        LIMIT 1
    """), {"booking_id": booking_id, "user_id": user_id})).mappings().one_or_none()
    if booking is None:
        raise HTTPException(404, "Booking confirmation not found")

    itinerary = (await session.execute(text("""
        SELECT id, stop_order, title, description, duration_minutes
        FROM experience_itinerary_stops
        WHERE experience_id = :experience_id
        ORDER BY stop_order
    """), {"experience_id": booking["experience_id"]})).mappings().all()
    media = (await session.execute(text("""
        SELECT url FROM experience_media
        WHERE experience_id = :experience_id AND media_type = 'image'
        ORDER BY sort_order
    """), {"experience_id": booking["experience_id"]})).scalars().all()
    price_groups = (await session.execute(text("""
        SELECT number_of_person, base_price
        FROM experience_price_group
        WHERE experience_id = :experience_id
        ORDER BY base_price
    """), {"experience_id": booking["experience_id"]})).mappings().all()

    return {
        "booking": dict(booking),
        "experience": {
            "id": booking["experience_id"],
            "slug": booking["experience_slug"],
            "title": booking["title"],
            "description": booking["description"],
            "duration_minutes": booking["duration_minutes"],
            "max_capacity": booking["max_capacity"],
            "base_price": booking["base_price"],
            "currency": booking["currency"],
            "meeting_address": booking["meeting_address"],
            "category": booking["category"],
            "inclusions": booking["inclusions"] or [],
            "exclusions": booking["exclusions"] or [],
            "requirements": booking["requirements"] or [],
            "group_type": booking["group_type"],
            "activity_level": booking["activity_level"],
            "is_accessible": booking["is_accessible"],
            "is_instant_book": booking["is_instant_book"],
            "themes": booking["themes"] or [],
            "time_of_day": booking["time_of_day"] or [],
            "rating": booking["rating"],
            "review_count": booking["review_count"],
            "images": list(media),
            "itinerary": [dict(stop) for stop in itinerary],
            "price_groups": [dict(group) for group in price_groups],
            "provider": {
                "name": booking["provider_name"],
                "bio": booking["provider_bio"],
                "avatar": booking["provider_avatar"],
            },
        },
        "payment": {
            "provider": booking["payment_provider"],
            "status": booking["payment_status"] or ("paid" if booking["status"] == "confirmed" else "pending"),
            "external_id": booking["external_payment_id"],
        },
    }

@app.post("/api/traveler/payment-methods/stripe/setup")
async def setup_stripe_payment(user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    if not settings.stripe_secret_key: raise HTTPException(503, "Stripe sandbox is not configured yet")
    user=(await session.execute(text("SELECT email FROM users WHERE id=:id"),{"id":user_id})).mappings().one_or_none()
    if user is None: raise HTTPException(404,"Traveler not found")
    stripe.api_key=settings.stripe_secret_key
    checkout=stripe.checkout.Session.create(mode="setup",customer_email=user["email"],payment_method_types=["card"],success_url=f"{settings.frontend_url}/app/traveler/settings?payment=stripe-success",cancel_url=f"{settings.frontend_url}/app/traveler/settings?payment=cancelled",metadata={"user_id":str(user_id)})
    return {"redirect_url":checkout.url}

@app.post("/api/traveler/payment-methods/paypal/setup")
async def setup_paypal_payment(user_id: UUID = Depends(current_user_id)) -> dict:
    token=await paypal_access_token()
    payload={"payment_source":{"paypal":{"description":"GuideVerse saved PayPal account","usage_pattern":"IMMEDIATE","experience_context":{"return_url":f"{settings.frontend_url}/app/traveler/settings?payment=paypal-return","cancel_url":f"{settings.frontend_url}/app/traveler/settings?payment=cancelled"}}}}
    async with httpx.AsyncClient(timeout=20) as client:
        response=await client.post(f"{paypal_api_base()}/v3/vault/setup-tokens",json=payload,headers={"Authorization":f"Bearer {token}","Content-Type":"application/json","PayPal-Request-Id":secrets.token_hex(16)})
    if response.is_error: raise HTTPException(502,"Could not start PayPal account linking")
    result=response.json(); approval=next((link["href"] for link in result.get("links",[]) if link.get("rel") in ("approve","payer-action")),None)
    if not approval: raise HTTPException(502,"PayPal did not return an approval link")
    return {"redirect_url":approval}

@app.post("/api/traveler/payment-methods/paypal/complete")
async def complete_paypal_payment(payload: dict, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    setup_token=str(payload.get("token","")).strip()
    if not setup_token: raise HTTPException(422,"Missing PayPal setup token")
    access=await paypal_access_token()
    body={"payment_source":{"token":{"id":setup_token,"type":"SETUP_TOKEN"}}}
    async with httpx.AsyncClient(timeout=20) as client:
        response=await client.post(f"{paypal_api_base()}/v3/vault/payment-tokens",json=body,headers={"Authorization":f"Bearer {access}","Content-Type":"application/json","PayPal-Request-Id":secrets.token_hex(16)})
    if response.is_error: raise HTTPException(502,"PayPal account linking could not be completed")
    result=response.json(); source=result.get("payment_source",{}).get("paypal",{}); label=source.get("email_address") or "PayPal account"
    row=(await session.execute(text("""INSERT INTO traveler_payment_methods(user_id,provider,provider_payment_method_id,provider_customer_id,brand,last4,display_label)
      VALUES(:user_id,'paypal',:token,:customer,'PayPal',NULL,:label) ON CONFLICT(provider,provider_payment_method_id) DO UPDATE SET display_label=EXCLUDED.display_label
      RETURNING id,provider,brand,last4,expiry_month,expiry_year,display_label"""),{"user_id":user_id,"token":result["id"],"customer":result.get("customer",{}).get("id"),"label":label})).mappings().one(); await session.commit()
    return dict(row)

@app.delete("/api/traveler/payment-methods/{payment_id}",status_code=204)
async def remove_payment_method(payment_id: UUID, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> None:
    row=(await session.execute(text("SELECT provider,provider_payment_method_id FROM traveler_payment_methods WHERE id=:id AND user_id=:user"),{"id":payment_id,"user":user_id})).mappings().one_or_none()
    if row is None: raise HTTPException(404,"Payment method not found")
    if row["provider"]=="stripe" and settings.stripe_secret_key:
        stripe.api_key=settings.stripe_secret_key; stripe.PaymentMethod.detach(row["provider_payment_method_id"])
    elif row["provider"]=="paypal" and settings.paypal_client_id:
        access=await paypal_access_token()
        async with httpx.AsyncClient(timeout=20) as client: response=await client.delete(f"{paypal_api_base()}/v3/vault/payment-tokens/{row['provider_payment_method_id']}",headers={"Authorization":f"Bearer {access}"})
        if response.is_error and response.status_code!=404: raise HTTPException(502,"PayPal could not remove this account")
    await session.execute(text("DELETE FROM traveler_payment_methods WHERE id=:id AND user_id=:user"),{"id":payment_id,"user":user_id}); await session.commit()

@app.post("/api/payments/stripe/webhook",include_in_schema=False)
async def stripe_webhook(request: Request, session: AsyncSession = Depends(get_session)) -> dict:
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret: raise HTTPException(503,"Stripe webhook is not configured")
    try: event=stripe.Webhook.construct_event(await request.body(),request.headers.get("stripe-signature", ""),settings.stripe_webhook_secret)
    except (ValueError,stripe.error.SignatureVerificationError) as error: raise HTTPException(400,"Invalid Stripe webhook") from error
    if event["type"]=="checkout.session.completed":
        checkout=event["data"]["object"]; stripe.api_key=settings.stripe_secret_key
        if checkout.get("mode")=="payment":
            await confirm_paid_booking(UUID(checkout["metadata"]["booking_id"]),checkout["id"],session)
        else:
            user_id=UUID(checkout["metadata"]["user_id"])
            intent=stripe.SetupIntent.retrieve(checkout["setup_intent"]); method=stripe.PaymentMethod.retrieve(intent["payment_method"]); card=method["card"]
            await session.execute(text("""INSERT INTO traveler_payment_methods(user_id,provider,provider_payment_method_id,provider_customer_id,brand,last4,expiry_month,expiry_year,display_label)
              VALUES(:user_id,'stripe',:token,:customer,:brand,:last4,:month,:year,:label) ON CONFLICT(provider,provider_payment_method_id) DO NOTHING"""),{"user_id":user_id,"token":method["id"],"customer":checkout.get("customer"),"brand":card["brand"].title(),"last4":card["last4"],"month":card["exp_month"],"year":card["exp_year"],"label":f"{card['brand'].title()} ending in {card['last4']}"}); await session.commit()
    return {"received":True}

@app.put("/api/traveler/settings/profile")
async def update_traveler_profile(payload: dict, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    name = str(payload.get("name", "")).strip(); email = str(payload.get("email", "")).strip().lower(); phone = str(payload.get("phone", "")).strip() or None
    avatar_url = payload.get("avatar_url")
    if avatar_url is not None and (not isinstance(avatar_url, str) or len(avatar_url) > 3_000_000 or (avatar_url and not (avatar_url.startswith("data:image/") or avatar_url.startswith("http://") or avatar_url.startswith("https://")))):
        raise HTTPException(422, "Upload a valid image smaller than 2 MB")
    if len(name) < 2 or "@" not in email: raise HTTPException(422, "Enter a valid name and email address")
    first, *rest = name.split(); last = " ".join(rest)
    try:
        row=(await session.execute(text("UPDATE users SET first_name=:first,last_name=:last,email=:email,phone=:phone,avatar_url=:avatar,updated_at=CURRENT_TIMESTAMP WHERE id=:id RETURNING id,first_name,last_name,email,phone,avatar_url,account_status"),{"id":user_id,"first":first,"last":last,"email":email,"phone":phone,"avatar":avatar_url})).mappings().one_or_none(); await session.commit()
    except Exception as error:
        await session.rollback(); raise HTTPException(409, "That email address is already in use") from error
    if row is None: raise HTTPException(404,"Traveler not found")
    return dict(row)

@app.put("/api/traveler/settings/notifications")
async def update_traveler_notifications(payload: dict, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    values={key:bool(payload.get(key, False)) for key in ("booking","messages","safety","promotions")}
    await session.execute(text("INSERT INTO traveler_notification_preferences(user_id,booking,messages,safety,promotions) VALUES(:id,:booking,:messages,:safety,:promotions) ON CONFLICT(user_id) DO UPDATE SET booking=:booking,messages=:messages,safety=:safety,promotions=:promotions,updated_at=CURRENT_TIMESTAMP"),{"id":user_id,**values}); await session.commit(); return values

@app.post("/api/traveler/settings/emergency-contacts",status_code=201)
async def add_emergency_contact(payload: dict, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    name=str(payload.get("name","")).strip(); phone=str(payload.get("phone","")).strip()
    if not name or len(phone)<7: raise HTTPException(422,"Enter a name and valid phone number")
    row=(await session.execute(text("INSERT INTO traveler_emergency_contacts(user_id,name,phone) VALUES(:id,:name,:phone) RETURNING id,name,phone"),{"id":user_id,"name":name,"phone":phone})).mappings().one(); await session.commit(); return dict(row)

@app.delete("/api/traveler/settings/emergency-contacts/{contact_id}",status_code=204)
async def delete_emergency_contact(contact_id: UUID, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> None:
    await session.execute(text("DELETE FROM traveler_emergency_contacts WHERE id=:contact_id AND user_id=:user_id"),{"contact_id":contact_id,"user_id":user_id}); await session.commit()

@app.put("/api/traveler/settings/account-status")
async def update_account_status(payload: dict, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    status = payload.get("status")
    if status not in ("active","deactivated"): raise HTTPException(422,"Unsupported account status")
    await session.execute(text("UPDATE users SET account_status=:status,updated_at=CURRENT_TIMESTAMP WHERE id=:id"),{"id":user_id,"status":status}); await session.commit(); return {"account_status":status}

@app.get("/api/traveler/dashboard")
async def traveler_dashboard(user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    user=(await session.execute(text("SELECT first_name,last_name,email FROM users WHERE id=:id"),{"id":user_id})).mappings().one_or_none()
    if user is None: raise HTTPException(404,"Traveler not found")
    trip=(await session.execute(text("""SELECT b.id,b.title,b.start_time,b.booking_reference,p.business_name,u.first_name,u.last_name,c.id AS conversation_id
      FROM bookings b JOIN providers p ON p.id=b.provider_id JOIN users u ON u.id=p.user_id
      LEFT JOIN conversations c ON c.booking_id=b.id AND c.traveler_id=:user_id
      WHERE b.traveler_id=:user_id AND b.status IN ('confirmed','pending') AND b.start_time>=CURRENT_TIMESTAMP
      ORDER BY b.start_time LIMIT 1"""),{"user_id":user_id})).mappings().one_or_none()
    recommendations=(await session.execute(text("""SELECT e.id,e.slug,e.title,e.meeting_address AS location,e.base_price AS price,e.currency,
      COALESCE(pts.average_rating,0) AS rating,(SELECT url FROM experience_media WHERE experience_id=e.id ORDER BY sort_order LIMIT 1) AS image
      FROM experiences e LEFT JOIN provider_trust_scores pts ON pts.provider_id=e.provider_id WHERE e.is_published=TRUE ORDER BY e.created_at DESC LIMIT 4"""))).mappings().all()
    nearby_query=next((str(row["location"]).split(",")[0] for row in recommendations if row["location"]),"")
    custom_requests=(await session.execute(text("""SELECT cr.id,cr.title,cr.destination_name,cr.start_date,cr.end_date,cr.status,
      COUNT(DISTINCT cb.id) AS proposal_count,
      COUNT(m.id) FILTER (WHERE m.read_at IS NULL AND m.sender_user_id<>:user) AS unread_message_count,
      MAX(COALESCE(m.created_at,cb.created_at,cr.created_at)) AS last_activity_at
      FROM custom_requests cr LEFT JOIN custom_request_bids cb ON cb.request_id=cr.id
      LEFT JOIN custom_request_bid_messages m ON m.bid_id=cb.id
      WHERE cr.traveler_id=:user GROUP BY cr.id ORDER BY last_activity_at DESC NULLS LAST LIMIT 5"""),{"user":user_id})).mappings().all()
    return {"user":dict(user),"upcoming_trip":dict(trip) if trip else None,"recommendations":[dict(row) for row in recommendations],"nearby_query":nearby_query,"custom_requests":[dict(row) for row in custom_requests]}

@app.get("/api/traveler/notifications")
async def traveler_notifications(user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows=(await session.execute(text("""SELECT * FROM (
      SELECT 'proposal' AS type,cb.id,cr.id AS request_id,cr.title,
        'A provider sent a proposal for your trip request' AS message,cb.created_at AS created_at,
        (SELECT COUNT(*) FROM custom_request_bid_messages m WHERE m.bid_id=cb.id AND m.read_at IS NULL AND m.sender_user_id<>:user) AS unread_count
      FROM custom_request_bids cb JOIN custom_requests cr ON cr.id=cb.request_id
      WHERE cr.traveler_id=:user AND NOT cb.is_hidden
      UNION ALL
      SELECT 'reply',m.id,cr.id,cr.title,'A provider replied in your proposal room',m.created_at,1
      FROM custom_request_bid_messages m JOIN custom_request_bids cb ON cb.id=m.bid_id JOIN custom_requests cr ON cr.id=cb.request_id
      JOIN providers p ON p.id=cb.provider_id WHERE cr.traveler_id=:user AND m.sender_user_id<>:user AND m.read_at IS NULL
    ) activity ORDER BY created_at DESC LIMIT 30"""),{"user":user_id})).mappings().all()
    return [dict(row) for row in rows]

@app.get("/api/traveler/custom-requests")
async def traveler_custom_requests(user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows=(await session.execute(text("""SELECT cr.*,COUNT(cb.id) AS proposal_count FROM custom_requests cr LEFT JOIN custom_request_bids cb ON cb.request_id=cr.id
      WHERE cr.traveler_id=:user GROUP BY cr.id ORDER BY cr.created_at DESC"""),{"user":user_id})).mappings().all(); return [dict(x) for x in rows]

@app.post("/api/traveler/custom-requests",status_code=201)
async def create_traveler_custom_request(payload: dict, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    try:
        start_date=date.fromisoformat(payload["start_date"]); end_date=date.fromisoformat(payload["end_date"]); today=datetime.now(timezone.utc).date()
        if start_date<today or end_date<today: raise HTTPException(422,"Choose dates today or later")
        if end_date<start_date: raise HTTPException(422,"End date cannot be before start date")
        row=(await session.execute(text("""INSERT INTO custom_requests(traveler_id,title,destination_name,start_date,end_date,group_size,budget_max,currency,description,vibe_tags,group_type,dates_flexible,status)
          VALUES(:user,:title,:destination,:start,:end,:size,:budget,'USD',:description,CAST(:tags AS JSONB),:group_type,:flexible,'open') RETURNING *"""),{"user":user_id,"title":str(payload.get("title","")).strip(),"destination":str(payload.get("destination_name","")).strip(),"start":start_date,"end":end_date,"size":int(payload["group_size"]),"budget":Decimal(str(payload["budget_max"])),"description":str(payload.get("description","")).strip(),"tags":__import__('json').dumps(payload.get("vibe_tags",[])),"group_type":payload.get("group_type","private") if payload.get("group_type") in ("private","group") else "private","flexible":bool(payload.get("dates_flexible",False))})).mappings().one(); await session.commit(); return dict(row)
    except (KeyError,ValueError,TypeError) as error: await session.rollback(); raise HTTPException(422,"Enter valid request details") from error

@app.put("/api/traveler/custom-requests/{request_id}")
async def update_traveler_custom_request(request_id: UUID, payload: dict, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    try:
        start_date=date.fromisoformat(payload["start_date"]); end_date=date.fromisoformat(payload["end_date"]); today=datetime.now(timezone.utc).date()
    except (KeyError,ValueError) as error: raise HTTPException(422,"Enter valid request dates") from error
    if start_date<today or end_date<today: raise HTTPException(422,"Choose dates today or later")
    if end_date<start_date: raise HTTPException(422,"End date cannot be before start date")
    row=(await session.execute(text("""UPDATE custom_requests SET title=:title,destination_name=:destination,start_date=:start,end_date=:end,group_size=:size,budget_max=:budget,description=:description,vibe_tags=CAST(:tags AS JSONB),group_type=:group_type,dates_flexible=:flexible
      WHERE id=:id AND traveler_id=:user AND status<>'withdrawn' RETURNING *"""),{"id":request_id,"user":user_id,"title":payload["title"],"destination":payload["destination_name"],"start":start_date,"end":end_date,"size":int(payload["group_size"]),"budget":Decimal(str(payload["budget_max"])),"description":payload.get("description",""),"tags":__import__('json').dumps(payload.get("vibe_tags",[])),"group_type":payload.get("group_type","private") if payload.get("group_type") in ("private","group") else "private","flexible":bool(payload.get("dates_flexible",False))})).mappings().one_or_none()
    if row is None: raise HTTPException(404,"Custom request not found")
    await session.commit(); return dict(row)

@app.delete("/api/traveler/custom-requests/{request_id}",status_code=204)
async def withdraw_traveler_custom_request(request_id: UUID, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> None:
    await session.execute(text("UPDATE custom_requests SET status='withdrawn' WHERE id=:id AND traveler_id=:user"),{"id":request_id,"user":user_id}); await session.commit()

@app.get("/api/traveler/custom-requests/{request_id}/proposals")
async def traveler_request_proposals(request_id: UUID, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows=(await session.execute(text("""SELECT cb.id,cb.provider_id,cb.status,cb.quoted_price,cb.proposed_itinerary,cb.portfolio_experience_id,cb.created_at,p.business_name AS provider_name,p.public_slug,p.bio AS provider_bio,
      (SELECT COUNT(*) FROM custom_request_bid_messages m WHERE m.bid_id=cb.id) AS message_count,
      (SELECT COUNT(*) FROM custom_request_bid_messages m WHERE m.bid_id=cb.id AND m.read_at IS NULL AND m.sender_user_id<>:user) AS unread_provider_message_count,
      COALESCE(pts.average_rating,0) AS rating FROM custom_request_bids cb JOIN custom_requests cr ON cr.id=cb.request_id JOIN providers p ON p.id=cb.provider_id
      LEFT JOIN provider_trust_scores pts ON pts.provider_id=p.id WHERE cb.request_id=:id AND cr.traveler_id=:user AND cb.status NOT IN ('rejected','withdrawn') AND NOT cb.is_hidden ORDER BY cb.quoted_price"""),{"id":request_id,"user":user_id})).mappings().all(); return [dict(x) for x in rows]

@app.get("/api/traveler/custom-requests/{request_id}/proposals/{proposal_id}/room")
async def traveler_proposal_room(request_id: UUID, proposal_id: UUID, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    room=await ProviderOperationsRepository(session).proposal_room(proposal_id,traveler_id=user_id)
    if room is None or room["proposal"]["request_id"]!=request_id: raise HTTPException(404,"Proposal room not found")
    await session.execute(text("UPDATE custom_request_bid_messages SET read_at=CURRENT_TIMESTAMP WHERE bid_id=:bid AND sender_user_id<>:user"),{"bid":proposal_id,"user":user_id}); await session.commit()
    room["messages"]=[{**message,"self":message["sender_user_id"]==user_id} for message in room["messages"]]
    return room

@app.post("/api/traveler/custom-requests/{request_id}/proposals/{proposal_id}/messages",status_code=201)
async def traveler_proposal_message(request_id: UUID, proposal_id: UUID, payload: MessageCreate, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    room=await ProviderOperationsRepository(session).proposal_room(proposal_id,traveler_id=user_id)
    if room is None or room["proposal"]["request_id"]!=request_id: raise HTTPException(404,"Proposal room not found")
    result=await ProviderOperationsRepository(session).send_proposal_message(proposal_id,user_id,payload.body)
    if result is None: raise HTTPException(409,"This proposal is no longer open for discussion")
    return result

@app.post("/api/traveler/custom-requests/{request_id}/proposals/{proposal_id}/accept")
async def accept_traveler_proposal(request_id: UUID, proposal_id: UUID, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    proposal=(await session.execute(text("""SELECT cb.id,cb.provider_id,cb.quoted_price,cb.currency,cb.portfolio_experience_id,
      cr.title,cr.start_date,cr.end_date,cr.group_size,cr.traveler_id,
      e.title AS experience_title,e.duration_minutes,e.max_capacity
      FROM custom_request_bids cb JOIN custom_requests cr ON cr.id=cb.request_id
      LEFT JOIN experiences e ON e.id=cb.portfolio_experience_id
      WHERE cb.id=:proposal AND cb.request_id=:request AND cr.traveler_id=:user AND cb.status IN ('pending','negotiating') AND cr.status='open'"""),{"proposal":proposal_id,"request":request_id,"user":user_id})).mappings().one_or_none()
    if proposal is None: raise HTTPException(404,"Proposal not found or no longer available")
    if proposal["portfolio_experience_id"] is None or proposal["experience_title"] is None:
        fallback=(await session.execute(text("""SELECT id,title,duration_minutes,max_capacity
          FROM experiences WHERE provider_id=:provider AND is_published=TRUE ORDER BY created_at LIMIT 1"""), {"provider":proposal["provider_id"]})).mappings().one_or_none()
        if fallback is None: raise HTTPException(422,"This proposal cannot be booked because the provider has no published experience")
        proposal={**dict(proposal), "portfolio_experience_id":fallback["id"], "experience_title":fallback["title"], "duration_minutes":fallback["duration_minutes"], "max_capacity":fallback["max_capacity"]}
    if proposal["start_date"] < datetime.now(timezone.utc).date(): raise HTTPException(422,"This proposal date has passed")
    fee=(Decimal(proposal["quoted_price"])*Decimal("0.04")).quantize(Decimal("0.01")); total=Decimal(proposal["quoted_price"])+fee
    end_time=datetime.combine(proposal["start_date"],time(9,0),tzinfo=timezone.utc)+timedelta(minutes=proposal["duration_minutes"] or 60)
    booking=(await session.execute(text("""INSERT INTO bookings(booking_reference,traveler_id,provider_id,experience_id,title,start_time,end_time,participant_count,gross_amount,platform_fee,net_provider_payout,currency,status)
      VALUES(:ref,:traveler,:provider,:experience,:title,:start,:end,:guests,:gross,:fee,:net,:currency,'pending_payment') RETURNING id"""),{"ref":f"GV-{secrets.token_hex(5).upper()}","traveler":user_id,"provider":proposal["provider_id"],"experience":proposal["portfolio_experience_id"],"title":proposal["experience_title"] or proposal["title"],"start":datetime.combine(proposal["start_date"],time(9,0),tzinfo=timezone.utc),"end":end_time,"guests":proposal["group_size"],"gross":total,"fee":fee,"net":proposal["quoted_price"],"currency":proposal["currency"]})).mappings().one()
    await session.execute(text("UPDATE custom_requests SET status='accepted' WHERE id=:id"),{"id":request_id})
    await session.execute(text("UPDATE custom_request_bids SET status=CASE WHEN id=:proposal THEN 'accepted' ELSE 'rejected' END WHERE request_id=:request"),{"proposal":proposal_id,"request":request_id})
    await session.commit()
    return {"booking_id":booking["id"],"experience_id":proposal["portfolio_experience_id"],"date":proposal["start_date"],"guests":proposal["group_size"]}

@app.get("/api/traveler/trips")
async def traveler_trips(user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows=(await session.execute(text("""SELECT b.id,b.title,b.start_time,b.end_time,b.participant_count,b.gross_amount,b.currency,b.status,b.booking_reference,
      COALESCE(p.business_name,u.first_name||' '||u.last_name) AS provider,c.id AS conversation_id FROM bookings b JOIN providers p ON p.id=b.provider_id JOIN users u ON u.id=p.user_id
      LEFT JOIN conversations c ON c.booking_id=b.id WHERE b.traveler_id=:user ORDER BY b.start_time DESC"""),{"user":user_id})).mappings().all(); return [dict(x) for x in rows]

@app.get("/api/traveler/conversations")
async def traveler_conversations(user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> list[dict]:
    conversations=(await session.execute(text("""SELECT c.id,c.subject,c.updated_at,p.business_name,u.first_name,u.last_name FROM conversations c JOIN providers p ON p.id=c.provider_id JOIN users u ON u.id=p.user_id
      WHERE c.traveler_id=:user ORDER BY c.updated_at DESC"""),{"user":user_id})).mappings().all(); result=[]
    for conversation in conversations:
        messages=(await session.execute(text("SELECT id,sender_user_id,body,created_at FROM conversation_messages WHERE conversation_id=:id ORDER BY created_at"),{"id":conversation["id"]})).mappings().all()
        item=dict(conversation); item["messages"]=[{**dict(message),"self":message["sender_user_id"]==user_id} for message in messages]; result.append(item)
    return result

@app.post("/api/traveler/conversations/{conversation_id}/messages",status_code=201)
async def send_traveler_message(conversation_id: UUID, payload: dict, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    body=str(payload.get("body","")).strip()
    if not body: raise HTTPException(422,"Message cannot be empty")
    owned=(await session.execute(text("SELECT 1 FROM conversations WHERE id=:id AND traveler_id=:user"),{"id":conversation_id,"user":user_id})).scalar_one_or_none()
    if not owned: raise HTTPException(404,"Conversation not found")
    row=(await session.execute(text("INSERT INTO conversation_messages(conversation_id,sender_user_id,body) VALUES(:id,:user,:body) RETURNING id,sender_user_id,body,created_at"),{"id":conversation_id,"user":user_id,"body":body})).mappings().one(); await session.execute(text("UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=:id"),{"id":conversation_id}); await session.commit(); return {**dict(row),"self":True}

@app.post("/api/traveler/ai-planner")
async def generate_traveler_plan(payload: dict, user_id: UUID = Depends(current_user_id), session: AsyncSession = Depends(get_session)) -> dict:
    prompt=str(payload.get("prompt","")).strip()
    if len(prompt)<3: raise HTTPException(422,"Tell the planner more about your destination and interests")
    words=[word for word in __import__('re').findall(r"[a-zA-Z]{3,}",prompt.lower()) if word not in {"with","days","trip","want","love"}][:8]
    pattern="%"+(words[0] if words else prompt.lower())+"%"
    rows=(await session.execute(text("""SELECT e.id,e.slug,e.title,e.base_price,e.currency,e.meeting_address,p.business_name FROM experiences e JOIN providers p ON p.id=e.provider_id
      WHERE e.is_published=TRUE AND (LOWER(e.title) LIKE :pattern OR LOWER(e.description) LIKE :pattern OR LOWER(e.meeting_address) LIKE :pattern)
      ORDER BY e.created_at DESC LIMIT 5"""),{"pattern":pattern})).mappings().all()
    if not rows: rows=(await session.execute(text("""SELECT e.id,e.slug,e.title,e.base_price,e.currency,e.meeting_address,p.business_name FROM experiences e JOIN providers p ON p.id=e.provider_id
      WHERE e.is_published=TRUE ORDER BY e.created_at DESC LIMIT 5"""))).mappings().all()
    itinerary=[{"day":index+1,"title":row["title"],"provider":row["business_name"],"experienceId":row["slug"],"price":float(row["base_price"]),"currency":row["currency"],"note":row["meeting_address"]} for index,row in enumerate(rows)]
    await session.execute(text("INSERT INTO traveler_ai_plans(traveler_id,prompt,itinerary) VALUES(:user,:prompt,CAST(:itinerary AS JSONB))"),{"user":user_id,"prompt":prompt,"itinerary":__import__('json').dumps(itinerary)}); await session.commit()
    return {"reply":f"I matched {len(itinerary)} live experiences from the GuideVerse catalog.","itinerary":itinerary}


@app.get("/api/provider/profile")
async def get_provider_profile(provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> dict:
    profile = await ProviderRepository(session).get_owned(provider_id)
    if profile is None: raise HTTPException(status_code=404, detail="Provider profile not found")
    return profile


@app.put("/api/provider/profile")
async def update_provider_profile(payload: ProviderProfileUpdate, provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> dict:
    try:
        profile = await ProviderRepository(session).update(provider_id, payload)
        if profile is None: raise HTTPException(status_code=404, detail="Provider profile not found")
        return profile
    except Exception as error:
        await session.rollback()
        if "public_slug" in str(error): raise HTTPException(status_code=409, detail="That public profile URL is already taken") from error
        raise


@app.delete("/api/provider/profile", status_code=204)
async def delete_provider_profile(provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> None:
    if not await ProviderRepository(session).delete_profile(provider_id):
        raise HTTPException(status_code=404, detail="Provider profile not found")


@app.get("/api/provider/dashboard")
async def provider_dashboard(provider_id: UUID=Depends(current_provider_id),session: AsyncSession=Depends(get_session)) -> dict:
    data=await ProviderOperationsRepository(session).dashboard(provider_id)
    if data is None: raise HTTPException(404,"Provider not found")
    return data

@app.get("/api/provider/bookings")
async def provider_bookings(provider_id: UUID=Depends(current_provider_id),session: AsyncSession=Depends(get_session)) -> list[dict]:
    return await ProviderOperationsRepository(session).bookings(provider_id)

@app.get("/api/provider/bookings/{booking_id}")
async def provider_booking_detail(booking_id: UUID, provider_id: UUID=Depends(current_provider_id),session: AsyncSession=Depends(get_session)) -> dict:
    booking = await ProviderOperationsRepository(session).booking(provider_id, booking_id)
    if booking is None: raise HTTPException(404,"Booking not found")
    return booking

@app.put("/api/provider/instant-availability",status_code=204)
async def update_instant(payload:InstantAvailabilityUpdate,provider_id:UUID=Depends(current_provider_id),session:AsyncSession=Depends(get_session))->None:
    await ProviderOperationsRepository(session).set_instant(provider_id,payload.is_available_now)

@app.get("/api/provider/calendar")
async def provider_calendar(start:date,end:date,provider_id:UUID=Depends(current_provider_id),session:AsyncSession=Depends(get_session))->dict:
    return await ProviderOperationsRepository(session).calendar(provider_id,start,end)

@app.put("/api/provider/calendar")
async def update_calendar(payload:AvailabilityUpdate,provider_id:UUID=Depends(current_provider_id),session:AsyncSession=Depends(get_session))->dict:
    result=await ProviderOperationsRepository(session).upsert_slot(provider_id,payload)
    if result is None:raise HTTPException(404,"Experience not found")
    return result

@app.get("/api/provider/bids")
async def provider_bids(provider_id:UUID=Depends(current_provider_id),session:AsyncSession=Depends(get_session))->dict:
    return await ProviderOperationsRepository(session).bid_feed(provider_id)

@app.post("/api/provider/bids/{request_id}",status_code=201)
async def create_provider_bid(request_id:UUID,payload:BidCreate,provider_id:UUID=Depends(current_provider_id),session:AsyncSession=Depends(get_session))->dict:
    result=await ProviderOperationsRepository(session).create_bid(provider_id,request_id,payload)
    if result is None:raise HTTPException(404,"Open request not found")
    return result

@app.get("/api/provider/bids/{bid_id}/room")
async def provider_proposal_room(bid_id: UUID, provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> dict:
    room=await ProviderOperationsRepository(session).proposal_room(bid_id,provider_id=provider_id)
    if room is None: raise HTTPException(404,"Proposal room not found")
    provider_user=await session.scalar(text("SELECT user_id FROM providers WHERE id=:id"),{"id":provider_id})
    await session.execute(text("UPDATE custom_request_bid_messages SET read_at=CURRENT_TIMESTAMP WHERE bid_id=:bid AND sender_user_id<>:user"),{"bid":bid_id,"user":provider_user}); await session.commit()
    room["messages"]=[{**message,"self":message["sender_user_id"]==provider_user} for message in room["messages"]]
    return room

@app.post("/api/provider/bids/{bid_id}/messages",status_code=201)
async def provider_proposal_message(bid_id: UUID, payload: MessageCreate, provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> dict:
    provider_user=await session.scalar(text("SELECT user_id FROM providers WHERE id=:id"),{"id":provider_id})
    room=await ProviderOperationsRepository(session).proposal_room(bid_id,provider_id=provider_id)
    if room is None or provider_user is None: raise HTTPException(404,"Proposal room not found")
    result=await ProviderOperationsRepository(session).send_proposal_message(bid_id,provider_user,payload.body)
    if result is None: raise HTTPException(409,"This proposal is no longer open for discussion")
    return result

@app.put("/api/provider/bids/{bid_id}")
async def update_provider_bid(bid_id: UUID, payload: dict, provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> dict:
    try: price=Decimal(str(payload.get("quoted_price"))); itinerary=str(payload.get("proposed_itinerary","")).strip()
    except Exception as error: raise HTTPException(422,"Enter a valid quote and itinerary") from error
    if price<=0 or len(itinerary)<20: raise HTTPException(422,"Quote must be positive and itinerary must be at least 20 characters")
    result=await ProviderOperationsRepository(session).update_bid(bid_id,provider_id,price,itinerary)
    if result is None: raise HTTPException(404,"Proposal not found or no longer editable")
    return result

@app.get("/api/provider/conversations")
async def provider_conversations(provider_id:UUID=Depends(current_provider_id),session:AsyncSession=Depends(get_session))->list[dict]:
    return await ProviderOperationsRepository(session).conversations(provider_id)

@app.post("/api/provider/conversations/{conversation_id}/messages",status_code=201)
async def send_provider_message(conversation_id:UUID,payload:MessageCreate,provider_id:UUID=Depends(current_provider_id),session:AsyncSession=Depends(get_session))->dict:
    result=await ProviderOperationsRepository(session).send_message(provider_id,conversation_id,payload.body)
    if result is None:raise HTTPException(404,"Conversation not found")
    return result

@app.get("/api/provider/earnings")
async def provider_earnings(start:date,end:date,provider_id:UUID=Depends(current_provider_id),session:AsyncSession=Depends(get_session))->dict:
    if start>end:raise HTTPException(422,"Start date cannot be after end date")
    return await ProviderOperationsRepository(session).earnings(provider_id,start,end)

@app.put("/api/provider/payout-settings",status_code=204)
async def update_payout_settings(payload:PayoutSettingsUpdate,provider_id:UUID=Depends(current_provider_id),session:AsyncSession=Depends(get_session))->None:
    await ProviderOperationsRepository(session).update_payout(provider_id,payload.payout_schedule)


@app.post("/api/provider/experiences", response_model=ExperienceCreated, status_code=201)
async def create_experience(
    payload: ExperienceCreate,
    provider_id: UUID = Depends(current_provider_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        return await ExperienceRepository(session).create(provider_id, payload)
    except ValueError as error:
        await session.rollback()
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/api/provider/experiences", response_model=list[ProviderExperienceListItem])
async def list_provider_experiences(provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> list[dict]:
    return await ExperienceRepository(session).list_for_provider(provider_id)


@app.get("/api/provider/experiences/{experience_id}")
async def get_provider_experience(experience_id: UUID, provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> dict:
    experience = await ExperienceRepository(session).get_owned(provider_id, experience_id)
    if experience is None:
        raise HTTPException(status_code=404, detail="Experience not found")
    return experience


@app.put("/api/provider/experiences/{experience_id}", response_model=ExperienceCreated)
async def update_provider_experience(experience_id: UUID, payload: ExperienceCreate, provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> dict:
    try:
        updated = await ExperienceRepository(session).update(provider_id, experience_id, payload)
        if updated is None:
            raise HTTPException(status_code=404, detail="Experience not found")
        return updated
    except ValueError as error:
        await session.rollback()
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.delete("/api/provider/experiences/{experience_id}", status_code=204)
async def delete_provider_experience(experience_id: UUID, provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> None:
    if not await ExperienceRepository(session).delete_owned(provider_id, experience_id):
        raise HTTPException(status_code=404, detail="Experience not found")


# ─────────────────────────────────────────────────────────────────────────────
# DESTINATION HUB  (public)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/destinations/{slug}")
async def get_destination_hub(slug: str, session: AsyncSession = Depends(get_session)) -> dict:
    """Return all destination hub data: intel fields, highlights, local experts, experiences."""
    row = (await session.execute(text("""
        SELECT id, name, hero_image_url, weather_summary, best_time_to_visit,
               currency_info, visa_info, languages, timezone, safety_status,
               emergency_numbers, getting_around_editorial, best_time_editorial
        FROM tour_locations
        WHERE LOWER(REPLACE(name,' ','-')) = LOWER(:slug) OR LOWER(name) = LOWER(:slug)
        LIMIT 1
    """), {"slug": slug})).mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Destination not found")
    destination = dict(row)
    loc_id = destination["id"]

    # Things to do (highlights)
    highlights = (await session.execute(text("""
        SELECT id, title, image_url, tag_native, tag_info, meta_info, price, is_free, display_order
        FROM destination_highlights
        WHERE location_id = :id
        ORDER BY display_order, title
    """), {"id": loc_id})).mappings().all()
    destination["highlights"] = [dict(h) for h in highlights]

    # Local experts (providers based in this location)
    experts = (await session.execute(text("""
        SELECT p.id, p.public_slug, p.business_name, u.first_name, u.last_name, u.avatar_url,
               p.identity_verified,
               COALESCE(pts.average_rating, 0) AS rating,
               COALESCE(pts.total_reviews, 0) AS review_count
        FROM providers p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN provider_trust_scores pts ON pts.provider_id = p.id
        WHERE LOWER(p.base_address) LIKE '%' || LOWER(:name) || '%'
        ORDER BY pts.average_rating DESC NULLS LAST
        LIMIT 8
    """), {"name": destination["name"]})).mappings().all()
    destination["local_experts"] = [dict(e) for e in experts]

    # Count of live experiences linked to this location
    exp_count = await session.scalar(text("""
        SELECT COUNT(*) FROM experiences
        WHERE is_published = TRUE AND LOWER(destination) LIKE '%' || LOWER(:name) || '%'
    """), {"name": destination["name"]})
    destination["experience_count"] = exp_count or 0
    destination["id"] = str(loc_id)
    return destination


# ─────────────────────────────────────────────────────────────────────────────
# DESTINATION HUB  (admin – CRUD + AI generation)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/admin/destinations")
async def admin_list_destinations(user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows = (await session.execute(text("""
        SELECT id, name, hero_image_url, weather_summary, best_time_to_visit,
               currency_info, visa_info, languages, timezone, safety_status,
               emergency_numbers, getting_around_editorial, best_time_editorial,
               display_order, created_at, updated_at
        FROM tour_locations ORDER BY display_order, name
    """))).mappings().all()
    return [dict(r) for r in rows]


@app.get("/api/admin/destinations/{location_id}")
async def admin_get_destination(location_id: UUID, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> dict:
    row = (await session.execute(text("""
        SELECT id, name, hero_image_url, weather_summary, best_time_to_visit,
               currency_info, visa_info, languages, timezone, safety_status,
               emergency_numbers, getting_around_editorial, best_time_editorial,
               display_order, created_at, updated_at
        FROM tour_locations WHERE id = :id LIMIT 1
    """), {"id": location_id})).mappings().one_or_none()
    if row is None:
        raise HTTPException(404, "Destination not found")
    dest = dict(row)
    highlights = (await session.execute(text("""
        SELECT id, title, image_url, tag_native, tag_info, meta_info, price, is_free, display_order
        FROM destination_highlights WHERE location_id = :id ORDER BY display_order, title
    """), {"id": location_id})).mappings().all()
    dest["highlights"] = [dict(h) for h in highlights]
    return dest


@app.put("/api/admin/destinations/{location_id}")
async def admin_update_destination(location_id: UUID, payload: dict, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> dict:
    allowed = ["hero_image_url", "weather_summary", "best_time_to_visit", "currency_info",
               "visa_info", "languages", "timezone", "safety_status", "emergency_numbers",
               "getting_around_editorial", "best_time_editorial", "name"]
    updates = {k: payload.get(k) for k in allowed if k in payload}
    if not updates:
        raise HTTPException(422, "No valid fields to update")
    set_clause = ", ".join(f"{k}=:{k}" for k in updates)
    updates["id"] = location_id
    updates["user"] = user_id
    row = (await session.execute(text(f"""
        UPDATE tour_locations SET {set_clause}, updated_by=:user, updated_at=CURRENT_TIMESTAMP
        WHERE id=:id RETURNING id, name
    """), updates)).mappings().one_or_none()
    if row is None:
        raise HTTPException(404, "Destination not found")
    await session.commit()
    return dict(row)


@app.post("/api/admin/destinations/{location_id}/highlights", status_code=201)
async def admin_add_highlight(location_id: UUID, payload: dict, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> dict:
    title = str(payload.get("title") or "").strip()
    if not title:
        raise HTTPException(422, "title is required")
    row = (await session.execute(text("""
        INSERT INTO destination_highlights
          (location_id, title, image_url, tag_native, tag_info, meta_info, price, is_free, display_order)
        VALUES (:loc, :title, :image_url, :tag_native, :tag_info, :meta_info, :price, :is_free,
                COALESCE((SELECT MAX(display_order)+1 FROM destination_highlights WHERE location_id=:loc), 1))
        RETURNING id, title, image_url, tag_native, tag_info, meta_info, price, is_free, display_order
    """), {
        "loc": location_id, "title": title,
        "image_url": payload.get("image_url"), "tag_native": payload.get("tag_native"),
        "tag_info": payload.get("tag_info"), "meta_info": payload.get("meta_info"),
        "price": payload.get("price"), "is_free": bool(payload.get("is_free", False)),
    })).mappings().one()
    await session.commit()
    return dict(row)


@app.put("/api/admin/destinations/{location_id}/highlights/{highlight_id}")
async def admin_update_highlight(location_id: UUID, highlight_id: UUID, payload: dict, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> dict:
    row = (await session.execute(text("""
        UPDATE destination_highlights SET
          title=COALESCE(:title, title), image_url=COALESCE(:image_url, image_url),
          tag_native=COALESCE(:tag_native, tag_native), tag_info=COALESCE(:tag_info, tag_info),
          meta_info=COALESCE(:meta_info, meta_info), price=COALESCE(:price, price),
          is_free=COALESCE(:is_free, is_free), updated_at=CURRENT_TIMESTAMP
        WHERE id=:id AND location_id=:loc
        RETURNING id, title, image_url, tag_native, tag_info, meta_info, price, is_free, display_order
    """), {
        "id": highlight_id, "loc": location_id,
        "title": payload.get("title"), "image_url": payload.get("image_url"),
        "tag_native": payload.get("tag_native"), "tag_info": payload.get("tag_info"),
        "meta_info": payload.get("meta_info"), "price": payload.get("price"),
        "is_free": payload.get("is_free"),
    })).mappings().one_or_none()
    if row is None:
        raise HTTPException(404, "Highlight not found")
    await session.commit()
    return dict(row)


@app.delete("/api/admin/destinations/{location_id}/highlights/{highlight_id}", status_code=204)
async def admin_delete_highlight(location_id: UUID, highlight_id: UUID, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> None:
    deleted = await session.execute(text("DELETE FROM destination_highlights WHERE id=:id AND location_id=:loc RETURNING id"), {"id": highlight_id, "loc": location_id})
    if deleted.scalar_one_or_none() is None:
        raise HTTPException(404, "Highlight not found")
    await session.commit()


@app.post("/api/admin/destinations/{location_id}/generate-intel")
async def admin_generate_destination_intel(location_id: UUID, user_id: UUID = Depends(current_admin_id), session: AsyncSession = Depends(get_session)) -> dict:
    """Use AI to generate 'at a glance' intel for a destination and save it."""
    row = (await session.execute(text("SELECT name FROM tour_locations WHERE id=:id"), {"id": location_id})).one_or_none()
    if row is None:
        raise HTTPException(404, "Destination not found")
    destination_name = row[0]

    if not settings.openai_api_key:
        raise HTTPException(503, "AI generation is not configured (missing OPENAI_API_KEY)")

    prompt = f"""You are a travel expert. Generate a concise "at a glance" factual summary for the travel destination: {destination_name}.
Return ONLY a valid JSON object with these exact keys:
- weather_summary: Current typical weather (e.g. "28°C, Partly Cloudy")
- best_time_to_visit: Best months/season (e.g. "Dec–May (dry season)")
- currency_info: Currency with exchange note (e.g. "PHP (₱) · 1 USD ≈ ₱56")
- visa_info: Short visa requirement (e.g. "Visa-free 30 days for most nationalities")
- languages: Primary languages spoken (e.g. "English, Cebuano")
- timezone: Timezone (e.g. "GMT+8 (PST)")
- safety_status: One sentence safety status (e.g. "Exercise normal precautions — no current advisories")
- emergency_numbers: Key emergency numbers as a string (e.g. "Police/Ambulance: 911 | Tourist Police: (032) 254-0680")
- getting_around_editorial: 2-sentence tip on getting around
- best_time_editorial: 2-sentence editorial about best time to visit
"""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"},
                json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}], "response_format": {"type": "json_object"}, "max_tokens": 500},
            )
        resp.raise_for_status()
        intel = resp.json()["choices"][0]["message"]["content"]
        import json as _json
        intel_data = _json.loads(intel)
    except Exception as e:
        raise HTTPException(502, f"AI generation failed: {e}") from e

    allowed_keys = ["weather_summary", "best_time_to_visit", "currency_info", "visa_info",
                    "languages", "timezone", "safety_status", "emergency_numbers",
                    "getting_around_editorial", "best_time_editorial"]
    update_data = {k: intel_data.get(k) for k in allowed_keys if intel_data.get(k)}
    if not update_data:
        raise HTTPException(502, "AI returned empty data")
    set_clause = ", ".join(f"{k}=:{k}" for k in update_data)
    update_data["id"] = location_id
    update_data["user"] = user_id
    await session.execute(text(f"UPDATE tour_locations SET {set_clause}, updated_by=:user, updated_at=CURRENT_TIMESTAMP WHERE id=:id"), update_data)
    await session.commit()
    return {"message": f"Intel generated for {destination_name}", "data": update_data}


# ─────────────────────────────────────────────────────────────────────────────
# PROVIDER PORTFOLIO & AVAILABILITY  (provider-authenticated)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/provider/portfolio")
async def get_provider_portfolio(provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows = (await session.execute(text("""
        SELECT id, image_url, display_order FROM provider_portfolio
        WHERE provider_id = :id ORDER BY display_order
    """), {"id": provider_id})).mappings().all()
    return [dict(r) for r in rows]


@app.post("/api/provider/portfolio", status_code=201)
async def add_provider_portfolio(payload: dict, provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> dict:
    image_url = str(payload.get("image_url") or "").strip()
    if not image_url:
        raise HTTPException(422, "image_url is required")
    row = (await session.execute(text("""
        INSERT INTO provider_portfolio (provider_id, image_url, display_order)
        VALUES (:pid, :url, COALESCE((SELECT MAX(display_order)+1 FROM provider_portfolio WHERE provider_id=:pid), 1))
        RETURNING id, image_url, display_order
    """), {"pid": provider_id, "url": image_url})).mappings().one()
    await session.commit()
    return dict(row)


@app.delete("/api/provider/portfolio/{item_id}", status_code=204)
async def delete_provider_portfolio(item_id: UUID, provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> None:
    deleted = await session.execute(text("DELETE FROM provider_portfolio WHERE id=:id AND provider_id=:pid RETURNING id"), {"id": item_id, "pid": provider_id})
    if deleted.scalar_one_or_none() is None:
        raise HTTPException(404, "Portfolio item not found")
    await session.commit()


@app.get("/api/provider/availability-slots")
async def get_provider_availability(year: int, month: int, provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows = (await session.execute(text("""
        SELECT id, date, status FROM provider_availability
        WHERE provider_id = :id AND EXTRACT(YEAR FROM date)=:year AND EXTRACT(MONTH FROM date)=:month
        ORDER BY date
    """), {"id": provider_id, "year": year, "month": month})).mappings().all()
    return [dict(r) for r in rows]


@app.put("/api/provider/availability-slots")
async def upsert_provider_availability(payload: dict, provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> dict:
    slot_date = payload.get("date")
    status = payload.get("status", "open")
    if not slot_date:
        raise HTTPException(422, "date is required")
    if status not in ("open", "unavailable"):
        raise HTTPException(422, "status must be open or unavailable")
    row = (await session.execute(text("""
        INSERT INTO provider_availability (provider_id, date, status)
        VALUES (:pid, :date, :status)
        ON CONFLICT (provider_id, date) DO UPDATE SET status=EXCLUDED.status
        RETURNING id, date, status
    """), {"pid": provider_id, "date": slot_date, "status": status})).mappings().one()
    await session.commit()
    return dict(row)


@app.delete("/api/provider/availability-slots/{slot_date}", status_code=204)
async def delete_provider_availability(slot_date: date, provider_id: UUID = Depends(current_provider_id), session: AsyncSession = Depends(get_session)) -> None:
    await session.execute(text("DELETE FROM provider_availability WHERE provider_id=:pid AND date=:date"), {"pid": provider_id, "date": slot_date})
    await session.commit()


@app.get("/api/public/provider-availability/{provider_slug}")
async def get_public_provider_availability(provider_slug: str, year: int, month: int, session: AsyncSession = Depends(get_session)) -> list[dict]:
    pid = await session.scalar(text("SELECT id FROM providers WHERE public_slug=:slug OR id::text=:slug"), {"slug": provider_slug})
    if pid is None:
        raise HTTPException(404, "Provider not found")
    rows = (await session.execute(text("""
        SELECT date, status FROM provider_availability
        WHERE provider_id=:id AND EXTRACT(YEAR FROM date)=:year AND EXTRACT(MONTH FROM date)=:month
        ORDER BY date
    """), {"id": pid, "year": year, "month": month})).mappings().all()
    return [dict(r) for r in rows]
