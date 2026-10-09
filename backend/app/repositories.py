import base64
import hashlib
import hmac
import re
import secrets
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class ExperienceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _experience_columns(self) -> set[str]:
        rows = (await self.session.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'experiences'
        """))).scalars().all()
        return set(rows)

    async def get_published(self, identifier: str) -> dict | None:
        try:
            experience_id = UUID(identifier)
        except ValueError:
            experience_id = None

        lookup_clause = "e.id = :identifier_uuid" if experience_id else "e.slug = :identifier_slug"
        lookup_parameters = {"identifier_uuid": experience_id} if experience_id else {"identifier_slug": identifier}
        result = await self.session.execute(
            text("""
                SELECT e.id, e.provider_id, e.title, e.slug, e.description,
                       e.duration_minutes, e.max_capacity, e.base_price, e.currency,
                       e.cancellation_policy::text AS cancellation_policy,
                       e.destination, e.meeting_address,
                       ST_Y(e.meeting_point::geometry) AS latitude,
                       ST_X(e.meeting_point::geometry) AS longitude,
                       e.inclusions, e.exclusions, e.requirements,
                       e.group_type::text AS group_type, e.activity_level::text AS activity_level,
                       e.is_accessible, e.is_instant_book, e.themes, e.time_of_day,
                       pc.id AS category_id, pc.name AS category_name,
                       p.business_name, p.user_id, p.identity_verified,
                       u.first_name, u.last_name,
                       COALESCE(pts.trust_score, 0) AS trust_score,
                       COALESCE(pts.average_rating, 0) AS average_rating,
                       COALESCE(pts.total_reviews, 0) AS total_reviews
                FROM experiences e
                JOIN provider_categories pc ON pc.id = e.category_id
                JOIN providers p ON p.id = e.provider_id
                JOIN users u ON u.id = p.user_id
                LEFT JOIN provider_trust_scores pts ON pts.provider_id = p.id
                WHERE e.is_published = TRUE
                  AND LOOKUP_CLAUSE
                LIMIT 1
            """.replace("LOOKUP_CLAUSE", lookup_clause)),
            lookup_parameters,
        )
        row = result.mappings().one_or_none()
        if row is None:
            return None

        experience = dict(row)
        experience["category"] = {
            "id": experience.pop("category_id"),
            "name": experience.pop("category_name"),
        }
        experience["provider"] = {
            "id": experience["provider_id"],
            "business_name": experience.pop("business_name"),
            "identity_verified": experience.pop("identity_verified"),
            "user": {
                "id": experience.pop("user_id"),
                "first_name": experience.pop("first_name"),
                "last_name": experience.pop("last_name"),
            },
            "trust_score": {
                "trust_score": experience.pop("trust_score"),
                "average_rating": experience.pop("average_rating"),
                "total_reviews": experience.pop("total_reviews"),
            },
        }

        experience_id = experience["id"]
        experience["price_groups"] = await self._all("""
            SELECT price_id, number_of_person, base_price
            FROM experience_price_group WHERE experience_id = :id
            ORDER BY base_price
        """, experience_id)
        experience["itinerary_stops"] = await self._all("""
            SELECT id, stop_order, title, description, duration_minutes
            FROM experience_itinerary_stops WHERE experience_id = :id ORDER BY stop_order
        """, experience_id)
        experience["media"] = await self._all("""
            SELECT id, media_type, url, sort_order
            FROM experience_media WHERE experience_id = :id ORDER BY sort_order
        """, experience_id)
        experience["reviews"] = await self._all("""
            SELECT r.id, r.rating, r.comment,
                   jsonb_build_object('first_name', u.first_name, 'last_name', u.last_name) AS traveler
            FROM reviews r JOIN users u ON u.id = r.traveler_id
            WHERE r.experience_id = :id ORDER BY r.created_at DESC LIMIT 20
        """, experience_id)
        experience["rating"] = experience["provider"]["trust_score"]["average_rating"]
        experience["review_count"] = experience["provider"]["trust_score"]["total_reviews"]
        return experience

    async def _all(self, query: str, experience_id: UUID) -> list[dict]:
        result = await self.session.execute(text(query), {"id": experience_id})
        return [dict(row) for row in result.mappings().all()]

    async def create(self, provider_id: UUID, payload) -> dict:
        category_result = await self.session.execute(
            text("SELECT id FROM provider_categories WHERE lower(name) = lower(:name) AND is_active = TRUE LIMIT 1"),
            {"name": payload.category},
        )
        category_id = category_result.scalar_one_or_none()
        if category_id is None:
            raise ValueError("The selected provider category does not exist or is inactive")

        provider_exists = await self.session.scalar(
            text("SELECT EXISTS(SELECT 1 FROM providers WHERE id = :id)"), {"id": provider_id}
        )
        if not provider_exists:
            raise ValueError("Provider does not exist")

        slug_base = re.sub(r"[^a-z0-9]+", "-", payload.title.lower()).strip("-")[:220] or "experience"
        slug = f"{slug_base}-{uuid4().hex[:8]}"
        result = await self.session.execute(text("""
            INSERT INTO experiences (
                provider_id, title, slug, description, category_id, duration_minutes,
                max_capacity, base_price, currency, cancellation_policy,
                meeting_point, destination, meeting_address, inclusions, exclusions, requirements, is_published,
                group_type, activity_level, is_accessible, is_instant_book, themes, time_of_day
            ) VALUES (
                :provider_id, :title, :slug, :description, :category_id, :duration_minutes,
                :max_capacity, :base_price, :currency, CAST(:cancellation_policy AS cancellation_policy_enum),
                ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
                :destination, :meeting_address, CAST(:inclusions AS jsonb), CAST(:exclusions AS jsonb),
                CAST(:requirements AS jsonb), :is_published,
                CAST(:group_type AS group_type_enum), CAST(:activity_level AS activity_level_enum),
                :is_accessible, :is_instant_book, CAST(:themes AS jsonb), CAST(:time_of_day AS jsonb)
            ) RETURNING id, slug, is_published
        """), {
            "provider_id": provider_id, "category_id": category_id,
            "title": payload.title, "slug": slug, "description": payload.description,
            "duration_minutes": payload.duration_minutes, "max_capacity": payload.max_capacity,
            "base_price": payload.base_price, "currency": payload.currency,
            "cancellation_policy": payload.cancellation_policy,
            "longitude": payload.longitude, "latitude": payload.latitude,
            "destination": payload.destination,
            "meeting_address": payload.meeting_address,
            "inclusions": __import__("json").dumps(payload.inclusions),
            "exclusions": __import__("json").dumps(payload.exclusions),
            "requirements": __import__("json").dumps(payload.requirements),
            "is_published": payload.is_published,
            "group_type": payload.group_type,
            "activity_level": payload.activity_level,
            "is_accessible": payload.is_accessible,
            "is_instant_book": payload.is_instant_book,
            "themes": __import__("json").dumps(payload.themes),
            "time_of_day": __import__("json").dumps(payload.time_of_day),
        })
        created = dict(result.mappings().one())
        experience_id = created["id"]

        for order, stop in enumerate(payload.itinerary_stops, start=1):
            await self.session.execute(text("""
                INSERT INTO experience_itinerary_stops
                    (experience_id, stop_order, title, description, duration_minutes)
                VALUES (:experience_id, :stop_order, :title, :description, :duration_minutes)
            """), {"experience_id": experience_id, "stop_order": order, **stop.model_dump()})
        for group in payload.price_groups:
            await self.session.execute(text("""
                INSERT INTO experience_price_group (experience_id, number_of_person, base_price)
                VALUES (:experience_id, :number_of_person, :base_price)
            """), {"experience_id": experience_id, **group.model_dump()})
        for order, url in enumerate(payload.media_urls):
            await self.session.execute(text("""
                INSERT INTO experience_media (experience_id, media_type, url, sort_order)
                VALUES (:experience_id, 'image', :url, :sort_order)
            """), {"experience_id": experience_id, "url": url, "sort_order": order})

        await self.session.commit()
        return created

    async def list_for_provider(self, provider_id: UUID) -> list[dict]:
        result = await self.session.execute(text("""
            SELECT e.id, e.title, e.slug, e.is_published, e.base_price, e.currency,
                   e.max_capacity, e.updated_at,
                   (SELECT em.url FROM experience_media em WHERE em.experience_id = e.id ORDER BY em.sort_order LIMIT 1) AS image_url
            FROM experiences e WHERE e.provider_id = :provider_id ORDER BY e.updated_at DESC
        """), {"provider_id": provider_id})
        return [dict(row) for row in result.mappings().all()]

    async def get_owned(self, provider_id: UUID, experience_id: UUID) -> dict | None:
        result = await self.session.execute(text("""
            SELECT e.id, e.title, e.description, pc.name AS category, e.duration_minutes,
                   e.max_capacity, e.base_price, e.currency,
                   e.cancellation_policy::text AS cancellation_policy, e.destination, e.meeting_address,
                   ST_Y(e.meeting_point::geometry) AS latitude,
                   ST_X(e.meeting_point::geometry) AS longitude,
                    e.inclusions, e.exclusions, e.requirements, e.is_published,
                    e.group_type::text AS group_type, e.activity_level::text AS activity_level,
                    e.is_accessible, e.is_instant_book, e.themes, e.time_of_day
            FROM experiences e JOIN provider_categories pc ON pc.id = e.category_id
            WHERE e.id = :id AND e.provider_id = :provider_id
        """), {"id": experience_id, "provider_id": provider_id})
        row = result.mappings().one_or_none()
        if row is None:
            return None
        item = dict(row)
        item["itinerary_stops"] = await self._all("SELECT id, title, description, duration_minutes FROM experience_itinerary_stops WHERE experience_id=:id ORDER BY stop_order", experience_id)
        item["price_groups"] = await self._all("SELECT price_id, number_of_person, base_price FROM experience_price_group WHERE experience_id=:id ORDER BY base_price", experience_id)
        media = await self._all("SELECT url FROM experience_media WHERE experience_id=:id ORDER BY sort_order", experience_id)
        item["media_urls"] = [entry["url"] for entry in media]
        return item

    async def update(self, provider_id: UUID, experience_id: UUID, payload) -> dict | None:
        owned = await self.session.scalar(text("SELECT EXISTS(SELECT 1 FROM experiences WHERE id=:id AND provider_id=:provider_id)"), {"id": experience_id, "provider_id": provider_id})
        if not owned:
            return None
        category_id = await self.session.scalar(text("SELECT id FROM provider_categories WHERE lower(name)=lower(:name) AND is_active=TRUE"), {"name": payload.category})
        if category_id is None:
            raise ValueError("The selected provider category does not exist or is inactive")
        await self.session.execute(text("""
            UPDATE experiences SET title=:title, description=:description, category_id=:category_id,
                duration_minutes=:duration_minutes, max_capacity=:max_capacity, base_price=:base_price,
                currency=:currency, cancellation_policy=CAST(:cancellation_policy AS cancellation_policy_enum),
                meeting_point=ST_SetSRID(ST_MakePoint(:longitude,:latitude),4326)::geography,
                destination=:destination, meeting_address=:meeting_address, inclusions=CAST(:inclusions AS jsonb),
                exclusions=CAST(:exclusions AS jsonb), requirements=CAST(:requirements AS jsonb),
                is_published=:is_published,
                group_type=CAST(:group_type AS group_type_enum),
                activity_level=CAST(:activity_level AS activity_level_enum),
                is_accessible=:is_accessible, is_instant_book=:is_instant_book,
                themes=CAST(:themes AS jsonb), time_of_day=CAST(:time_of_day AS jsonb),
                updated_at=CURRENT_TIMESTAMP
            WHERE id=:id AND provider_id=:provider_id
        """), {"id": experience_id, "provider_id": provider_id, "category_id": category_id,
            "title": payload.title, "description": payload.description, "duration_minutes": payload.duration_minutes,
            "max_capacity": payload.max_capacity, "base_price": payload.base_price, "currency": payload.currency,
            "cancellation_policy": payload.cancellation_policy, "longitude": payload.longitude, "latitude": payload.latitude,
            "destination": payload.destination,
            "meeting_address": payload.meeting_address, "inclusions": __import__("json").dumps(payload.inclusions),
            "exclusions": __import__("json").dumps(payload.exclusions), "requirements": __import__("json").dumps(payload.requirements),
            "is_published": payload.is_published,
            "group_type": payload.group_type, "activity_level": payload.activity_level,
            "is_accessible": payload.is_accessible, "is_instant_book": payload.is_instant_book,
            "themes": __import__("json").dumps(payload.themes), "time_of_day": __import__("json").dumps(payload.time_of_day)})
        for table in ("experience_itinerary_stops", "experience_price_group", "experience_media"):
            await self.session.execute(text(f"DELETE FROM {table} WHERE experience_id=:id"), {"id": experience_id})
        for order, stop in enumerate(payload.itinerary_stops, 1):
            await self.session.execute(text("INSERT INTO experience_itinerary_stops (experience_id,stop_order,title,description,duration_minutes) VALUES (:id,:position,:title,:description,:duration_minutes)"), {"id": experience_id, "position": order, **stop.model_dump()})
        for group in payload.price_groups:
            await self.session.execute(text("INSERT INTO experience_price_group (experience_id,number_of_person,base_price) VALUES (:id,:number_of_person,:base_price)"), {"id": experience_id, **group.model_dump()})
        for order, url in enumerate(payload.media_urls):
            await self.session.execute(text("INSERT INTO experience_media (experience_id,media_type,url,sort_order) VALUES (:id,'image',:url,:position)"), {"id": experience_id, "url": url, "position": order})
        await self.session.commit()
        return {"id": experience_id, "slug": await self.session.scalar(text("SELECT slug FROM experiences WHERE id=:id"), {"id": experience_id}), "is_published": payload.is_published}

    async def delete_owned(self, provider_id: UUID, experience_id: UUID) -> bool:
        result = await self.session.execute(text("DELETE FROM experiences WHERE id=:id AND provider_id=:provider_id RETURNING id"), {"id": experience_id, "provider_id": provider_id})
        deleted = result.scalar_one_or_none() is not None
        await self.session.commit()
        return deleted

    async def search(self, *, query: str | None, categories: list[str], min_price, max_price,
                     rating, languages: list[str], date_start, date_end, group_type: str | None,
                     instant: bool | None, themes: list[str], time_of_day: list[str],
                     activity_level: list[str], is_accessible: bool | None,
                     min_travelers: int | None, max_travelers: int | None,
                     duration_bucket: list[str], sort: str, page: int, page_size: int) -> dict:
        experience_columns = await self._experience_columns()
        has_group_type = "group_type" in experience_columns
        has_activity_level = "activity_level" in experience_columns
        has_is_accessible = "is_accessible" in experience_columns
        has_is_instant_book = "is_instant_book" in experience_columns
        has_themes = "themes" in experience_columns
        has_time_of_day = "time_of_day" in experience_columns
        clauses = ["e.is_published = TRUE"]
        params = {"limit": page_size, "offset": (page - 1) * page_size, "date_start": date_start, "date_end": date_end}
        if query:
            clauses.append("(e.title ILIKE :query OR e.description ILIKE :query OR e.destination ILIKE :query OR e.meeting_address ILIKE :query OR p.business_name ILIKE :query)")
            params["query"] = f"%{query}%"
        if categories:
            clauses.append("pc.name = ANY(:categories)"); params["categories"] = categories
        if min_price is not None:
            clauses.append("e.base_price >= :min_price"); params["min_price"] = min_price
        if max_price is not None:
            clauses.append("e.base_price <= :max_price"); params["max_price"] = max_price
        if rating is not None:
            clauses.append("COALESCE(pts.average_rating,0) >= :rating"); params["rating"] = rating
        if languages:
            clauses.append("EXISTS (SELECT 1 FROM provider_languages pl WHERE pl.provider_id=e.provider_id AND pl.language_code = ANY(:languages))")
            params["languages"] = languages
        if has_group_type and group_type == "private":
            clauses.append("e.group_type = 'private'")
        elif has_group_type and group_type == "group":
            clauses.append("e.group_type != 'private'")
        if has_is_instant_book and instant is True:
            clauses.append("e.is_instant_book = TRUE")
        if has_is_accessible and is_accessible is True:
            clauses.append("e.is_accessible = TRUE")
        if has_themes and themes:
            clauses.append("COALESCE(e.themes, '[]'::jsonb) ?| :themes")
            params["themes"] = themes
        if has_time_of_day and time_of_day:
            clauses.append("COALESCE(e.time_of_day, '[]'::jsonb) ?| :time_of_day")
            params["time_of_day"] = time_of_day
        if has_activity_level and activity_level:
            clauses.append("e.activity_level::text = ANY(:activity_level)")
            params["activity_level"] = activity_level
        if min_travelers is not None:
            clauses.append("e.max_capacity >= :min_travelers")
            params["min_travelers"] = min_travelers
        if max_travelers is not None:
            clauses.append("e.max_capacity <= :max_travelers")
            params["max_travelers"] = max_travelers
        if duration_bucket:
            bucket_clauses = []
            for index, bucket in enumerate(duration_bucket):
                if bucket == "0-2h":
                    bucket_clauses.append(f"(e.duration_minutes >= 0 AND e.duration_minutes < :duration_upper_{index})")
                    params[f"duration_upper_{index}"] = 120
                elif bucket == "2-4h":
                    bucket_clauses.append(f"(e.duration_minutes >= :duration_lower_{index} AND e.duration_minutes < :duration_upper_{index})")
                    params[f"duration_lower_{index}"] = 120
                    params[f"duration_upper_{index}"] = 240
                elif bucket == "4-6h":
                    bucket_clauses.append(f"(e.duration_minutes >= :duration_lower_{index} AND e.duration_minutes < :duration_upper_{index})")
                    params[f"duration_lower_{index}"] = 240
                    params[f"duration_upper_{index}"] = 360
                elif bucket == "fullday":
                    bucket_clauses.append(f"e.duration_minutes >= :duration_lower_{index}")
                    params[f"duration_lower_{index}"] = 360
            if bucket_clauses:
                clauses.append("(" + " OR ".join(bucket_clauses) + ")")
        if date_start or date_end:
            start = date_start or date_end; end = date_end or date_start
            clauses.append("EXISTS (SELECT 1 FROM experience_availability ea WHERE ea.experience_id=e.id AND ea.is_available AND ea.available_spots>0 AND ea.available_date BETWEEN :date_start AND :date_end)")
            params.update(date_start=start, date_end=end)
        where = " AND ".join(clauses)
        order = {
            "price_asc": "e.base_price ASC, e.created_at DESC",
            "price_desc": "e.base_price DESC, e.created_at DESC",
            "rating": "COALESCE(pts.average_rating,0) DESC, e.created_at DESC",
            "popular": "COALESCE(pts.total_reviews,0) DESC, e.created_at DESC",
        }.get(sort, "COALESCE(pts.trust_score,0) DESC, e.created_at DESC")
        joins = """FROM experiences e JOIN providers p ON p.id=e.provider_id
                   JOIN provider_categories pc ON pc.id=e.category_id
                   LEFT JOIN provider_trust_scores pts ON pts.provider_id=p.id
                   JOIN users u ON u.id=p.user_id"""
        total = await self.session.scalar(text(f"SELECT count(*) {joins} WHERE {where}"), params)
        group_type_select = "e.group_type::text AS group_type" if has_group_type else "'both' AS group_type"
        activity_level_select = "e.activity_level::text AS activity_level" if has_activity_level else "'moderate' AS activity_level"
        is_accessible_select = "e.is_accessible" if has_is_accessible else "FALSE AS is_accessible"
        is_instant_book_select = "e.is_instant_book" if has_is_instant_book else "FALSE AS is_instant_book"
        themes_select = "e.themes" if has_themes else "'[]'::jsonb AS themes"
        time_of_day_select = "e.time_of_day" if has_time_of_day else "'[]'::jsonb AS time_of_day"
        result = await self.session.execute(text(f"""
            SELECT e.id, e.slug, e.title, e.destination AS location, e.destination, e.meeting_address,
                   pc.name AS category,
                   e.base_price AS price, e.currency, COALESCE(pts.average_rating,0) AS rating,
                   COALESCE(pts.total_reviews,0) AS review_count, e.duration_minutes, e.max_capacity,
                   ST_Y(e.meeting_point::geometry) AS latitude, ST_X(e.meeting_point::geometry) AS longitude,
                   {group_type_select}, {activity_level_select},
                   {is_accessible_select}, {is_instant_book_select}, {themes_select}, {time_of_day_select},
                    COALESCE(p.business_name, u.first_name || ' ' || u.last_name) AS guide_name,
                   u.avatar_url AS guide_avatar,
                    COALESCE(p.identity_verified, FALSE) AS provider_verified,
                    CASE WHEN CAST(:date_start AS date) IS NULL AND CAST(:date_end AS date) IS NULL THEN NULL ELSE EXISTS (
                      SELECT 1 FROM experience_availability selected_availability
                      WHERE selected_availability.experience_id=e.id
                        AND selected_availability.is_available
                        AND selected_availability.available_spots>0
                        AND selected_availability.available_date BETWEEN COALESCE(CAST(:date_start AS date), CAST(:date_end AS date)) AND COALESCE(CAST(:date_end AS date), CAST(:date_start AS date))
                    ) END AS available_for_dates,
                   (SELECT em.url FROM experience_media em WHERE em.experience_id=e.id ORDER BY em.sort_order LIMIT 1) AS image
            {joins} WHERE {where} ORDER BY {order} LIMIT :limit OFFSET :offset
        """), params)
        facets_row = (await self.session.execute(text("""
            SELECT COALESCE(min(base_price),0) AS min_price,
                   COALESCE(max(base_price),1000) AS max_price,
                   COALESCE(min(max_capacity),1) AS min_capacity,
                   COALESCE(max(max_capacity),1) AS max_capacity
            FROM experiences WHERE is_published=TRUE
        """))).mappings().one()
        facet_categories = (await self.session.execute(text("""SELECT DISTINCT pc.name FROM experiences e JOIN provider_categories pc ON pc.id=e.category_id WHERE e.is_published=TRUE ORDER BY pc.name"""))).scalars().all()
        facet_languages = (await self.session.execute(text("""SELECT DISTINCT pl.language_code FROM provider_languages pl JOIN experiences e ON e.provider_id=pl.provider_id WHERE e.is_published=TRUE ORDER BY pl.language_code"""))).scalars().all()
        facet_themes = (await self.session.execute(text("""SELECT DISTINCT jsonb_array_elements_text(COALESCE(e.themes,'[]'::jsonb)) AS value FROM experiences e WHERE e.is_published=TRUE ORDER BY value"""))).scalars().all() if has_themes else []
        facet_time_of_day = (await self.session.execute(text("""SELECT DISTINCT jsonb_array_elements_text(COALESCE(e.time_of_day,'[]'::jsonb)) AS value FROM experiences e WHERE e.is_published=TRUE ORDER BY value"""))).scalars().all() if has_time_of_day else []
        facet_activity_levels = (await self.session.execute(text("""SELECT DISTINCT e.activity_level::text AS value FROM experiences e WHERE e.is_published=TRUE ORDER BY value"""))).scalars().all() if has_activity_level else []
        facet_group_types = (await self.session.execute(text("""SELECT DISTINCT e.group_type::text AS value FROM experiences e WHERE e.is_published=TRUE ORDER BY value"""))).scalars().all() if has_group_type else []
        facet_locations = (await self.session.execute(text("""SELECT DISTINCT e.destination FROM experiences e WHERE e.is_published=TRUE AND e.destination IS NOT NULL AND e.destination <> '' ORDER BY e.destination LIMIT 50"""))).scalars().all()
        return {"items": [dict(row) for row in result.mappings()], "total": total or 0, "page": page,
                "page_size": page_size, "facets": {"categories": list(facet_categories), "languages": list(facet_languages), "themes": list(facet_themes), "time_of_day": list(facet_time_of_day), "activity_levels": list(facet_activity_levels), "group_types": list(facet_group_types), "locations": list(facet_locations), **dict(facets_row)}}


class ProviderRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_public(self, identifier: str) -> dict | None:
        try: provider_id = UUID(identifier)
        except ValueError: provider_id = None
        clause = "p.id=:id" if provider_id else "p.public_slug=:slug"
        params = {"id": provider_id} if provider_id else {"slug": identifier}
        result = await self.session.execute(text(f"""
            SELECT p.id, p.public_slug, p.business_name, p.bio, p.cover_url, p.video_intro_url,
                   p.base_address, p.hourly_rate, p.currency, p.years_experience,
                   p.identity_verified, p.is_accepting_custom_requests,
                   u.first_name, u.last_name, u.avatar_url,
                   COALESCE(pts.trust_score,0) AS trust_score, COALESCE(pts.average_rating,0) AS rating,
                   COALESCE(pts.total_reviews,0) AS review_count
            FROM providers p JOIN users u ON u.id=p.user_id
            LEFT JOIN provider_trust_scores pts ON pts.provider_id=p.id WHERE {clause} LIMIT 1
        """), params)
        row = result.mappings().one_or_none()
        if row is None: return None
        profile = dict(row); pid = profile["id"]
        profile["languages"] = list((await self.session.execute(text("SELECT language_code FROM provider_languages WHERE provider_id=:id ORDER BY language_code"), {"id": pid})).scalars())
        profile["categories"] = list((await self.session.execute(text("SELECT pc.name FROM provider_category_mappings pcm JOIN provider_categories pc ON pc.id=pcm.category_id WHERE pcm.provider_id=:id ORDER BY pc.name"), {"id": pid})).scalars())
        profile["portfolio_urls"] = list((await self.session.execute(text("SELECT url FROM provider_portfolio_media WHERE provider_id=:id ORDER BY sort_order"), {"id": pid})).scalars())
        listings = await self.session.execute(text("""
            SELECT e.id,e.slug,e.title,e.duration_minutes,e.meeting_address,e.base_price,e.currency,
              (SELECT url FROM experience_media WHERE experience_id=e.id ORDER BY sort_order LIMIT 1) AS image
            FROM experiences e WHERE e.provider_id=:id AND e.is_published=TRUE ORDER BY e.updated_at DESC
        """), {"id": pid})
        profile["listings"] = [dict(item) for item in listings.mappings()]
        return profile

    async def get_owned(self, provider_id: UUID) -> dict | None:
        return await self.get_public(str(provider_id))

    async def update(self, provider_id: UUID, payload) -> dict | None:
        result = await self.session.execute(text("""
            UPDATE providers SET business_name=:business_name, public_slug=:public_slug, bio=:bio,
              cover_url=:cover_url, video_intro_url=:video_intro_url, base_address=:base_address,
              hourly_rate=:hourly_rate, currency=:currency, years_experience=:years_experience,
              is_accepting_custom_requests=:accepting, updated_at=CURRENT_TIMESTAMP
            WHERE id=:id RETURNING user_id
        """), {"id": provider_id, "business_name": payload.business_name, "public_slug": payload.public_slug,
          "bio": payload.bio, "cover_url": payload.cover_url, "video_intro_url": payload.video_intro_url,
          "base_address": payload.base_address, "hourly_rate": payload.hourly_rate, "currency": payload.currency,
          "years_experience": payload.years_experience, "accepting": payload.is_accepting_custom_requests})
        user_id = result.scalar_one_or_none()
        if user_id is None: return None
        await self.session.execute(text("UPDATE users SET first_name=:first,last_name=:last,avatar_url=:avatar,updated_at=CURRENT_TIMESTAMP WHERE id=:id"), {"id": user_id, "first": payload.first_name, "last": payload.last_name, "avatar": payload.avatar_url})
        await self.session.execute(text("DELETE FROM provider_languages WHERE provider_id=:id"), {"id": provider_id})
        for code in sorted(set(payload.languages)):
            await self.session.execute(text("INSERT INTO provider_languages(provider_id,language_code) VALUES(:id,:code)"), {"id": provider_id, "code": code.upper()[:10]})
        await self.session.execute(text("DELETE FROM provider_category_mappings WHERE provider_id=:id"), {"id": provider_id})
        if payload.categories:
            await self.session.execute(text("""INSERT INTO provider_category_mappings(provider_id,category_id) SELECT :id,id FROM provider_categories WHERE name=ANY(:categories)"""), {"id": provider_id, "categories": payload.categories})
        await self.session.execute(text("DELETE FROM provider_portfolio_media WHERE provider_id=:id"), {"id": provider_id})
        for order, url in enumerate(payload.portfolio_urls):
            await self.session.execute(text("INSERT INTO provider_portfolio_media(provider_id,url,sort_order) VALUES(:id,:url,:position)"), {"id": provider_id, "url": url, "position": order})
        await self.session.commit()
        return await self.get_owned(provider_id)

    async def delete_profile(self, provider_id: UUID) -> bool:
        result = await self.session.execute(text("DELETE FROM providers WHERE id=:id RETURNING user_id"), {"id": provider_id})
        user_id = result.scalar_one_or_none()
        if user_id is None: return False
        await self.session.execute(text("UPDATE users SET primary_role='traveler',updated_at=CURRENT_TIMESTAMP WHERE id=:id"), {"id": user_id})
        await self.session.commit(); return True


class ProviderOperationsRepository:
    def __init__(self, session: AsyncSession) -> None: self.session = session

    async def dashboard(self, provider_id: UUID) -> dict:
        profile = (await self.session.execute(text("""SELECT p.identity_verified,COALESCE(t.trust_score,0) trust_score,COALESCE(t.response_rate_pct,100) response_rate FROM providers p LEFT JOIN provider_trust_scores t ON t.provider_id=p.id WHERE p.id=:id"""),{"id":provider_id})).mappings().one_or_none()
        if profile is None: return None
        earnings = await self.session.scalar(text("SELECT COALESCE(sum(net_provider_payout),0) FROM bookings WHERE provider_id=:id AND start_time>=date_trunc('month',CURRENT_DATE)"),{"id":provider_id})
        completed = await self.session.scalar(text("SELECT count(*) FROM bookings WHERE provider_id=:id AND status='completed'"),{"id":provider_id})
        pending_bids = await self.session.scalar(text("SELECT count(*) FROM custom_requests r WHERE r.status='open' AND NOT EXISTS(SELECT 1 FROM custom_request_bids b WHERE b.request_id=r.id AND b.provider_id=:id)"),{"id":provider_id})
        instant = await self.session.scalar(text("SELECT is_available_now FROM provider_instant_availability WHERE provider_id=:id"),{"id":provider_id}) or False
        schedule = (await self.session.execute(text("""SELECT b.id,b.start_time,b.end_time,b.title,b.participant_count,b.status,u.first_name,u.last_name FROM bookings b JOIN users u ON u.id=b.traveler_id WHERE b.provider_id=:id AND b.start_time::date=CURRENT_DATE ORDER BY b.start_time"""),{"id":provider_id})).mappings().all()
        return {**dict(profile),"earnings_this_month":earnings,"completed_bookings":completed,"pending_bid_requests":pending_bids,"instant_available":instant,"today_schedule":[dict(row) for row in schedule]}

    async def set_instant(self, provider_id: UUID, enabled: bool) -> None:
        await self.session.execute(text("""INSERT INTO provider_instant_availability(provider_id,is_available_now,available_until) VALUES(:id,:enabled,CASE WHEN :enabled THEN CURRENT_TIMESTAMP+INTERVAL '8 hours' END) ON CONFLICT(provider_id) DO UPDATE SET is_available_now=:enabled,available_until=CASE WHEN :enabled THEN CURRENT_TIMESTAMP+INTERVAL '8 hours' END,updated_at=CURRENT_TIMESTAMP"""),{"id":provider_id,"enabled":enabled}); await self.session.commit()

    async def bookings(self, provider_id: UUID) -> list[dict]:
        rows = (await self.session.execute(text("""
            SELECT b.id,b.booking_reference,b.title,b.start_time,b.end_time,b.participant_count,
                   b.gross_amount,b.platform_fee,b.net_provider_payout,b.currency,b.status,
                   b.experience_id,e.slug AS experience_slug,e.meeting_address,
                   traveler.id AS traveler_id,traveler.first_name AS traveler_first_name,
                   traveler.last_name AS traveler_last_name,traveler.email AS traveler_email,
                   COALESCE(es.status,'not_escrowed') AS escrow_status,
                   COALESCE(bp.status,CASE WHEN b.status='confirmed' THEN 'paid' ELSE 'pending' END) AS payment_status
            FROM bookings b
            LEFT JOIN experiences e ON e.id=b.experience_id
            JOIN users traveler ON traveler.id=b.traveler_id
            LEFT JOIN escrow_ledgers es ON es.booking_id=b.id
            LEFT JOIN LATERAL (
                SELECT status FROM booking_payments
                WHERE booking_id=b.id
                ORDER BY created_at DESC
                LIMIT 1
            ) bp ON TRUE
            WHERE b.provider_id=:provider
            ORDER BY b.start_time DESC
        """), {"provider": provider_id})).mappings().all()
        return [dict(row) for row in rows]

    async def booking(self, provider_id: UUID, booking_id: UUID) -> dict | None:
        rows = await self.bookings(provider_id)
        return next((row for row in rows if row["id"] == booking_id), None)

    async def calendar(self, provider_id: UUID, start, end) -> dict:
        experiences=(await self.session.execute(text("SELECT id,title,max_capacity FROM experiences WHERE provider_id=:id ORDER BY title"),{"id":provider_id})).mappings().all()
        slots=(await self.session.execute(text("""SELECT ea.id,ea.experience_id,ea.available_date,ea.available_spots,ea.is_available,ea.surge_multiplier FROM experience_availability ea JOIN experiences e ON e.id=ea.experience_id WHERE e.provider_id=:id AND ea.available_date BETWEEN :start AND :end ORDER BY ea.available_date"""),{"id":provider_id,"start":start,"end":end})).mappings().all()
        return {"experiences":[dict(x) for x in experiences],"slots":[dict(x) for x in slots]}

    async def upsert_slot(self, provider_id: UUID, payload) -> dict | None:
        owned=await self.session.scalar(text("SELECT EXISTS(SELECT 1 FROM experiences WHERE id=:eid AND provider_id=:pid)"),{"eid":payload.experience_id,"pid":provider_id})
        if not owned:return None
        row=(await self.session.execute(text("""INSERT INTO experience_availability(experience_id,available_date,available_spots,is_available,surge_multiplier) VALUES(:experience_id,:available_date,:available_spots,:is_available,:surge_multiplier) ON CONFLICT(experience_id,available_date) DO UPDATE SET available_spots=EXCLUDED.available_spots,is_available=EXCLUDED.is_available,surge_multiplier=EXCLUDED.surge_multiplier RETURNING id,experience_id,available_date,available_spots,is_available,surge_multiplier"""),payload.model_dump())).mappings().one();await self.session.commit();return dict(row)

    async def bid_feed(self, provider_id: UUID) -> dict:
        rows=(await self.session.execute(text("""SELECT r.id,r.title,r.destination_name,r.start_date,r.end_date,r.group_size,r.budget_max,r.currency,r.description,r.vibe_tags,r.group_type,r.status AS request_status,r.created_at,
          b.id AS bid_id,b.status AS bid_status,b.quoted_price,b.proposed_itinerary,b.portfolio_experience_id,b.created_at AS bid_created_at,
           (SELECT bk.id FROM bookings bk WHERE bk.provider_id=b.provider_id AND bk.traveler_id=r.traveler_id
             AND bk.start_time::date=r.start_date AND bk.participant_count=r.group_size AND bk.status<>'cancelled'
             ORDER BY bk.created_at DESC LIMIT 1) AS booking_id,
          (SELECT COUNT(*) FROM custom_request_bid_messages m WHERE m.bid_id=b.id) AS message_count,
           (SELECT COUNT(*) FROM custom_request_bid_messages m WHERE m.bid_id=b.id AND m.read_at IS NULL
             AND m.sender_user_id <> (SELECT user_id FROM providers WHERE id=:id)) AS unread_traveler_message_count,
          (SELECT MAX(m.created_at) FROM custom_request_bid_messages m WHERE m.bid_id=b.id) AS last_message_at
          FROM custom_requests r LEFT JOIN custom_request_bids b ON b.request_id=r.id AND b.provider_id=:id
          WHERE r.status='open' OR b.id IS NOT NULL ORDER BY r.created_at DESC"""),{"id":provider_id})).mappings().all();output=[]
        listings=(await self.session.execute(text("SELECT id,title FROM experiences WHERE provider_id=:id ORDER BY title"),{"id":provider_id})).mappings().all()
        return {"requests":[dict(x) for x in rows],"listings":[dict(x) for x in listings]}

    async def create_bid(self, provider_id: UUID, request_id: UUID, payload) -> dict | None:
        exists=await self.session.scalar(text("SELECT EXISTS(SELECT 1 FROM custom_requests WHERE id=:id AND status='open')"),{"id":request_id})
        if not exists:return None
        row=(await self.session.execute(text("""INSERT INTO custom_request_bids(request_id,provider_id,proposed_itinerary,quoted_price,currency,portfolio_experience_id) VALUES(:request_id,:provider_id,:proposed_itinerary,:quoted_price,:currency,:portfolio_experience_id) ON CONFLICT(request_id,provider_id) DO UPDATE SET proposed_itinerary=EXCLUDED.proposed_itinerary,quoted_price=EXCLUDED.quoted_price,currency=EXCLUDED.currency,portfolio_experience_id=EXCLUDED.portfolio_experience_id,created_at=CURRENT_TIMESTAMP RETURNING id,status"""),{"request_id":request_id,"provider_id":provider_id,**payload.model_dump()})).mappings().one();await self.session.commit();return dict(row)

    async def proposal_room(self, bid_id: UUID, provider_id: UUID | None = None, traveler_id: UUID | None = None) -> dict | None:
        condition="cb.provider_id=:provider" if provider_id else "cr.traveler_id=:traveler"
        params={"bid":bid_id,"provider":provider_id,"traveler":traveler_id}
        bid=(await self.session.execute(text(f"""SELECT cb.id,cb.request_id,cb.provider_id,cb.quoted_price,cb.currency,cb.proposed_itinerary,cb.portfolio_experience_id,cb.status,cb.created_at,
          cr.title,cr.destination_name,cr.start_date,cr.end_date,cr.group_size,cr.budget_max,cr.description,cr.vibe_tags,cr.group_type,
          p.business_name AS provider_name,p.public_slug,COALESCE(pts.average_rating,0) AS rating
          FROM custom_request_bids cb JOIN custom_requests cr ON cr.id=cb.request_id JOIN providers p ON p.id=cb.provider_id
          LEFT JOIN provider_trust_scores pts ON pts.provider_id=p.id WHERE cb.id=:bid AND {condition}"""),params)).mappings().one_or_none()
        if bid is None: return None
        messages=(await self.session.execute(text("""SELECT cr.id,cr.traveler_id AS sender_user_id,cr.description AS body,cr.created_at,u.first_name,u.last_name
          FROM custom_requests cr JOIN users u ON u.id=cr.traveler_id
          WHERE cr.id=(SELECT request_id FROM custom_request_bids WHERE id=:bid)
            AND NULLIF(BTRIM(cr.description),'') IS NOT NULL
          UNION ALL
          SELECT m.id,m.sender_user_id,m.body,m.created_at,u.first_name,u.last_name
          FROM custom_request_bid_messages m JOIN users u ON u.id=m.sender_user_id
          WHERE m.bid_id=:bid
          ORDER BY created_at,id"""),{"bid":bid_id})).mappings().all()
        revisions=(await self.session.execute(text("""SELECT id,changed_by,quoted_price,proposed_itinerary,change_summary,created_at
          FROM custom_request_bid_revisions WHERE bid_id=:bid ORDER BY created_at DESC"""),{"bid":bid_id})).mappings().all()
        return {"proposal":dict(bid),"messages":[dict(message) for message in messages],"revisions":[dict(revision) for revision in revisions]}

    async def update_bid(self, bid_id: UUID, provider_id: UUID, price: Decimal, itinerary: str) -> dict | None:
        current=(await self.session.execute(text("""SELECT cb.quoted_price,cb.proposed_itinerary,cb.status
          FROM custom_request_bids cb JOIN custom_requests cr ON cr.id=cb.request_id
          WHERE cb.id=:bid AND cb.provider_id=:provider AND cr.status='open'"""),{"bid":bid_id,"provider":provider_id})).mappings().one_or_none()
        if current is None or current["status"] in ("accepted","rejected","withdrawn"): return None
        changes=[]
        if Decimal(str(current["quoted_price"])) != price: changes.append(f"Price changed from {current['quoted_price']} to {price}")
        if current["proposed_itinerary"] != itinerary: changes.append("Itinerary updated")
        provider_user=await self.session.scalar(text("SELECT user_id FROM providers WHERE id=:provider"),{"provider":provider_id})
        row=(await self.session.execute(text("""UPDATE custom_request_bids SET quoted_price=:price,proposed_itinerary=:itinerary,status='negotiating'
          WHERE id=:bid RETURNING id,quoted_price,proposed_itinerary,status"""),{"bid":bid_id,"price":price,"itinerary":itinerary})).mappings().one()
        await self.session.execute(text("""INSERT INTO custom_request_bid_revisions(bid_id,changed_by,quoted_price,proposed_itinerary,change_summary)
          VALUES(:bid,:user,:price,:itinerary,:summary)"""),{"bid":bid_id,"user":provider_user,"price":price,"itinerary":itinerary,"summary":"; ".join(changes) or "Proposal details confirmed"})
        await self.session.commit(); return dict(row)

    async def send_proposal_message(self, bid_id: UUID, user_id: UUID, body: str) -> dict | None:
        allowed=await self.session.scalar(text("""SELECT EXISTS(SELECT 1 FROM custom_request_bids cb JOIN custom_requests cr ON cr.id=cb.request_id JOIN providers p ON p.id=cb.provider_id WHERE cb.id=:bid AND (cr.traveler_id=:user OR p.user_id=:user) AND cb.status NOT IN ('accepted','rejected'))"""),{"bid":bid_id,"user":user_id})
        if not allowed: return None
        row=(await self.session.execute(text("INSERT INTO custom_request_bid_messages(bid_id,sender_user_id,body) VALUES(:bid,:user,:body) RETURNING id,sender_user_id,body,created_at"""),{"bid":bid_id,"user":user_id,"body":body})).mappings().one()
        await self.session.execute(text("UPDATE custom_request_bids SET status=CASE WHEN status='pending' THEN 'negotiating' ELSE status END WHERE id=:bid"),{"bid":bid_id}); await self.session.commit(); return {**dict(row),"self":True}

    async def conversations(self, provider_id: UUID) -> list[dict]:
        rows=(await self.session.execute(text("""SELECT c.id,c.booking_id,c.subject,c.updated_at,b.booking_reference,u.first_name,u.last_name FROM conversations c JOIN users u ON u.id=c.traveler_id LEFT JOIN bookings b ON b.id=c.booking_id WHERE c.provider_id=:id ORDER BY c.updated_at DESC"""),{"id":provider_id})).mappings().all();output=[]
        for row in rows:
            item=dict(row);messages=(await self.session.execute(text("""SELECT m.id,m.sender_user_id,m.body,m.created_at,(m.sender_user_id=p.user_id) AS self FROM conversation_messages m JOIN providers p ON p.id=:provider_id WHERE m.conversation_id=:conversation_id ORDER BY m.created_at"""),{"provider_id":provider_id,"conversation_id":item["id"]})).mappings().all();item["messages"]=[dict(x) for x in messages];output.append(item)
        return output

    async def send_message(self, provider_id: UUID, conversation_id: UUID, body: str) -> dict | None:
        user_id=await self.session.scalar(text("SELECT p.user_id FROM providers p JOIN conversations c ON c.provider_id=p.id WHERE p.id=:pid AND c.id=:cid"),{"pid":provider_id,"cid":conversation_id})
        if user_id is None:return None
        row=(await self.session.execute(text("INSERT INTO conversation_messages(conversation_id,sender_user_id,body) VALUES(:cid,:uid,:body) RETURNING id,sender_user_id,body,created_at"),{"cid":conversation_id,"uid":user_id,"body":body})).mappings().one();await self.session.execute(text("UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=:id"),{"id":conversation_id});await self.session.commit();result=dict(row);result["self"]=True;return result

    async def earnings(self, provider_id: UUID, start, end) -> dict:
        params={"id":provider_id,"start":start,"end":end}
        rows=(await self.session.execute(text("""SELECT b.id,b.booking_reference,b.title,b.start_time,b.gross_amount,b.platform_fee,b.net_provider_payout,b.currency,b.status,COALESCE(el.status,'not_escrowed') escrow_status FROM bookings b LEFT JOIN escrow_ledgers el ON el.booking_id=b.id WHERE b.provider_id=:id AND b.start_time::date BETWEEN :start AND :end ORDER BY b.start_time DESC"""),params)).mappings().all()
        available=await self.session.scalar(text("""SELECT COALESCE(sum(b.net_provider_payout),0) FROM bookings b LEFT JOIN escrow_ledgers e ON e.booking_id=b.id WHERE b.provider_id=:id AND (e.status='released_to_provider' OR e.id IS NULL)"""),{"id":provider_id})
        escrow=await self.session.scalar(text("SELECT COALESCE(sum(b.net_provider_payout),0) FROM bookings b JOIN escrow_ledgers e ON e.booking_id=b.id WHERE b.provider_id=:id AND e.status='held'"),{"id":provider_id})
        settings=(await self.session.execute(text("SELECT payout_schedule,account_connected,last_payout_failed FROM provider_payout_settings WHERE provider_id=:id"),{"id":provider_id})).mappings().one_or_none()
        return {"available_balance":available,"escrow_balance":escrow,"transactions":[dict(x) for x in rows],"payout_settings":dict(settings or {"payout_schedule":"weekly","account_connected":False,"last_payout_failed":False})}

    async def update_payout(self, provider_id: UUID, schedule: str) -> None:
        await self.session.execute(text("""INSERT INTO provider_payout_settings(provider_id,payout_schedule) VALUES(:id,:schedule) ON CONFLICT(provider_id) DO UPDATE SET payout_schedule=:schedule,updated_at=CURRENT_TIMESTAMP"""),{"id":provider_id,"schedule":schedule});await self.session.commit()


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def login(self, email: str, password: str) -> dict | None:
        user = (await self.session.execute(text("SELECT id,email,first_name,last_name,primary_role,avatar_url,account_status,password_hash FROM users WHERE lower(email)=lower(:email)"), {"email": email.strip()})).mappings().one_or_none()
        if user is None or not self._verify_password(password, user["password_hash"]):
            return None
        return {key: value for key, value in dict(user).items() if key != "password_hash"}

    async def signup(self, name: str, email: str, password: str, role: str, business_name: str | None = None, bio: str | None = None) -> dict:
        parts = name.strip().split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""
        row = (await self.session.execute(text("""INSERT INTO users(email,first_name,last_name,primary_role,account_status,password_hash) VALUES(:email,:fn,:ln,:role,'active',:password_hash) RETURNING id,email,first_name,last_name,primary_role,avatar_url,account_status"""), {"email": email.strip(), "fn": first_name, "ln": last_name, "role": role, "password_hash": self._hash_password(password)})).mappings().one()
        if role == "provider":
            provider = (await self.session.execute(text("INSERT INTO providers(user_id,business_name,bio) VALUES(:user,:business,:bio) RETURNING id"), {"user": row["id"], "business": business_name or f"{name.strip()} Experiences", "bio": bio or ""})).mappings().one()
            await self.session.execute(text("INSERT INTO provider_trust_scores(provider_id) VALUES(:id) ON CONFLICT DO NOTHING"), {"id": provider["id"]})
        await self.session.commit()
        return dict(row)

    async def create_password_reset(self, email: str) -> str | None:
        exists = await self.session.scalar(text("SELECT EXISTS(SELECT 1 FROM users WHERE lower(email)=lower(:email))"), {"email": email.strip()})
        if not exists:
            return None
        import uuid
        token = str(uuid.uuid4())
        await self.session.execute(text("INSERT INTO password_resets(email,reset_token,expires_at) VALUES(:email,:token,CURRENT_TIMESTAMP+INTERVAL '1 hour')"), {"email": email.strip(), "token": token})
        await self.session.commit()
        return token

    async def reset_password(self, token: str, password: str) -> bool:
        row = (await self.session.execute(text("""SELECT pr.id,u.id AS user_id FROM password_resets pr JOIN users u ON lower(u.email)=lower(pr.email)
          WHERE pr.reset_token=:token AND pr.used_at IS NULL AND pr.expires_at>CURRENT_TIMESTAMP"""), {"token": token})).mappings().one_or_none()
        if row is None:
            return False
        await self.session.execute(text("UPDATE users SET password_hash=:hash,updated_at=CURRENT_TIMESTAMP WHERE id=:id"), {"hash": self._hash_password(password), "id": row["user_id"]})
        await self.session.execute(text("UPDATE password_resets SET used_at=CURRENT_TIMESTAMP WHERE id=:id"), {"id": row["id"]})
        await self.session.commit()
        return True

    @staticmethod
    def _hash_password(password: str) -> str:
        iterations = 600_000
        salt = secrets.token_bytes(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
        return f"pbkdf2_sha256${iterations}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"

    @staticmethod
    def _verify_password(password: str, stored_hash: str | None) -> bool:
        if not stored_hash:
            return False
        try:
            algorithm, iterations, salt, digest = stored_hash.split("$", 3)
            if algorithm != "pbkdf2_sha256":
                return False
            calculated = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), int(iterations))
            return hmac.compare_digest(calculated, base64.b64decode(digest))
        except (ValueError, TypeError):
            return False
