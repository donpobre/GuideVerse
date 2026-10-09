"""Create foundational user and provider tables required by experiences."""
from alembic import op

revision = "20260802_00"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            avatar_url TEXT,
            primary_role VARCHAR(30) NOT NULL DEFAULT 'traveler',
            account_status VARCHAR(30) NOT NULL DEFAULT 'active',
            preferred_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
            preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS provider_categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS providers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            business_name VARCHAR(255),
            bio TEXT NOT NULL DEFAULT '',
            identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
            currency VARCHAR(3) NOT NULL DEFAULT 'USD',
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS provider_trust_scores (
            provider_id UUID PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
            trust_score DECIMAL(3,2) NOT NULL DEFAULT 5.00,
            total_reviews INT NOT NULL DEFAULT 0,
            average_rating DECIMAL(3,2) NOT NULL DEFAULT 5.00,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            traveler_id UUID NOT NULL REFERENCES users(id),
            provider_id UUID NOT NULL REFERENCES providers(id),
            rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
            comment TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS reviews")
    op.execute("DROP TABLE IF EXISTS provider_trust_scores")
    op.execute("DROP TABLE IF EXISTS providers")
    op.execute("DROP TABLE IF EXISTS provider_categories")
    op.execute("DROP TABLE IF EXISTS users")
