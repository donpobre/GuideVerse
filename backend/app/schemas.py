from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PriceGroupCreate(BaseModel):
    number_of_person: str = Field(min_length=1, max_length=200)
    base_price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)

    @field_validator("number_of_person")
    @classmethod
    def validate_person_rule(cls, value: str) -> str:
        import re
        normalized = value.strip()
        match = re.fullmatch(r"(\d+)(?:\s*-\s*(\d+))?", normalized)
        if not match or int(match.group(1)) < 1:
            raise ValueError("Use an exact person count or range such as 2 or 3-5")
        if match.group(2) and int(match.group(2)) < int(match.group(1)):
            raise ValueError("Person range must be ascending")
        return normalized.replace(" ", "")


class ItineraryStopCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    duration_minutes: int = Field(gt=0, le=10080)


class ExperienceCreate(BaseModel):
    title: str = Field(min_length=10, max_length=255)
    description: str = Field(min_length=20)
    category: str = Field(min_length=1, max_length=100)
    duration_minutes: int = Field(gt=0, le=10080)
    max_capacity: int = Field(gt=0, le=1000)
    base_price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    cancellation_policy: str = Field(pattern=r"^(flexible|moderate|strict)$")
    destination: str = Field(min_length=2, max_length=255)
    meeting_address: str = Field(min_length=3)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    inclusions: list[str] = Field(default_factory=list)
    exclusions: list[str] = Field(default_factory=list)
    requirements: list[str] = Field(default_factory=list)
    itinerary_stops: list[ItineraryStopCreate] = Field(default_factory=list)
    price_groups: list[PriceGroupCreate] = Field(default_factory=list)
    media_urls: list[str] = Field(default_factory=list)
    is_published: bool = False
    group_type: str = Field(default="both", pattern=r"^(private|group|both)$")
    activity_level: str = Field(default="moderate", pattern=r"^(minimal|moderate|high)$")
    is_accessible: bool = False
    is_instant_book: bool = False
    themes: list[str] = Field(default_factory=list)
    time_of_day: list[str] = Field(default_factory=list)


class ExperienceCreated(BaseModel):
    id: UUID
    slug: str
    is_published: bool


class ProviderExperienceListItem(BaseModel):
    id: UUID
    title: str
    slug: str
    is_published: bool
    base_price: Decimal
    currency: str
    max_capacity: int
    updated_at: Any
    image_url: str | None = None


class SearchExperienceItem(BaseModel):
    id: UUID
    slug: str
    title: str
    location: str
    category: str
    price: Decimal
    currency: str
    rating: Decimal
    review_count: int
    duration_minutes: int
    max_capacity: int
    image: str | None = None
    latitude: float
    longitude: float
    group_type: str = "both"
    activity_level: str = "moderate"
    is_accessible: bool = False
    is_instant_book: bool = False
    themes: list[Any] = Field(default_factory=list)
    time_of_day: list[Any] = Field(default_factory=list)
    guide_name: str | None = None
    guide_avatar: str | None = None
    provider_verified: bool = False
    available_for_dates: bool | None = None


class SearchFacets(BaseModel):
    categories: list[str]
    languages: list[str]
    themes: list[str]
    time_of_day: list[str]
    activity_levels: list[str]
    group_types: list[str]
    min_price: Decimal
    max_price: Decimal
    min_capacity: int
    max_capacity: int
    locations: list[str]


class SearchResponse(BaseModel):
    items: list[SearchExperienceItem]
    total: int
    page: int
    page_size: int
    facets: SearchFacets


class ProviderProfileUpdate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    business_name: str | None = Field(default=None, max_length=255)
    public_slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)
    bio: str = Field(min_length=50, max_length=1000)
    avatar_url: str | None = None
    cover_url: str | None = None
    video_intro_url: str | None = None
    base_address: str | None = Field(default=None, max_length=255)
    hourly_rate: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    years_experience: int = Field(default=0, ge=0, le=100)
    is_accepting_custom_requests: bool = True
    languages: list[str] = Field(default_factory=list)
    categories: list[str] = Field(default_factory=list)
    portfolio_urls: list[str] = Field(default_factory=list)


class InstantAvailabilityUpdate(BaseModel):
    is_available_now: bool


class AvailabilityUpdate(BaseModel):
    experience_id: UUID
    available_date: date
    available_spots: int = Field(ge=0, le=1000)
    is_available: bool = True
    surge_multiplier: Decimal = Field(default=1, ge=1, le=2.5)


class BidCreate(BaseModel):
    proposed_itinerary: str = Field(min_length=50, max_length=5000)
    quoted_price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    portfolio_experience_id: UUID | None = None


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class PayoutSettingsUpdate(BaseModel):
    payout_schedule: str = Field(pattern=r"^(daily|weekly|monthly)$")


class PriceGroupOut(BaseModel):
    price_id: UUID
    number_of_person: str
    base_price: Decimal


class ExperienceOut(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: UUID
    provider_id: UUID
    title: str
    slug: str
    description: str
    duration_minutes: int
    max_capacity: int
    base_price: Decimal
    currency: str
    cancellation_policy: str
    destination: str
    meeting_address: str
    inclusions: list[Any]
    exclusions: list[Any]
    requirements: list[Any]
    category: dict[str, Any]
    provider: dict[str, Any]
    price_groups: list[PriceGroupOut]
    itinerary_stops: list[dict[str, Any]]
    media: list[dict[str, Any]]
    reviews: list[dict[str, Any]]
    rating: Decimal
    review_count: int


class LoginSchema(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1)

class SignupSchema(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8)
    role: str = Field(default="traveler", pattern=r"^(traveler|provider)$")
    business_name: str | None = Field(default=None, max_length=255)
    bio: str | None = Field(default=None, max_length=1000)

class ForgotPasswordSchema(BaseModel):
    email: str = Field(min_length=3, max_length=255)
