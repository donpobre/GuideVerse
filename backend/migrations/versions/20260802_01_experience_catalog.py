"""Create the PostgreSQL experience catalog tables."""
from alembic import op

revision = "20260802_01"
down_revision = "20260802_00"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS postgis')
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    op.execute("""
        DO $$ BEGIN
          CREATE TYPE cancellation_policy_enum AS ENUM ('flexible', 'moderate', 'strict');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS experiences (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL UNIQUE,
            description TEXT NOT NULL,
            category_id UUID NOT NULL REFERENCES provider_categories(id),
            duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
            max_capacity INT NOT NULL DEFAULT 1 CHECK (max_capacity > 0),
            base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
            currency VARCHAR(3) NOT NULL DEFAULT 'USD',
            cancellation_policy cancellation_policy_enum NOT NULL DEFAULT 'moderate',
            meeting_point GEOGRAPHY(POINT,4326) NOT NULL,
            meeting_address TEXT NOT NULL,
            inclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
            exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
            requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
            is_published BOOLEAN NOT NULL DEFAULT FALSE,
            embedding vector(1536),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_experiences_provider ON experiences(provider_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_experiences_published ON experiences(is_published) WHERE is_published")
    op.execute("CREATE INDEX IF NOT EXISTS idx_experiences_meeting_point ON experiences USING GIST(meeting_point)")
    op.execute("""
        CREATE TABLE IF NOT EXISTS experience_itinerary_stops (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
            stop_order INT NOT NULL CHECK (stop_order > 0),
            title VARCHAR(200) NOT NULL,
            description TEXT,
            duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
            location GEOGRAPHY(POINT,4326),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(experience_id, stop_order)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS experience_price_group (
            price_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
            number_of_person VARCHAR(200) NOT NULL,
            base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
            UNIQUE(experience_id, number_of_person)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_experience_price_group_experience ON experience_price_group(experience_id)")
    op.execute("""
        CREATE TABLE IF NOT EXISTS experience_media (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
            media_type VARCHAR(20) NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
            url TEXT NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            UNIQUE(experience_id, sort_order)
        )
    """)
    op.execute("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS experience_id UUID REFERENCES experiences(id) ON DELETE CASCADE")
    op.execute("CREATE INDEX IF NOT EXISTS idx_reviews_experience ON reviews(experience_id, created_at DESC)")


def downgrade() -> None:
    op.execute("ALTER TABLE reviews DROP COLUMN IF EXISTS experience_id")
    op.execute("DROP TABLE IF EXISTS experience_media")
    op.execute("DROP TABLE IF EXISTS experience_price_group")
    op.execute("DROP TABLE IF EXISTS experience_itinerary_stops")
    op.execute("DROP TABLE IF EXISTS experiences")
    op.execute("DROP TYPE IF EXISTS cancellation_policy_enum")
