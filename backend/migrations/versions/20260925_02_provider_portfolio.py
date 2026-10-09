"""Add provider portfolio and availability for profile v2."""
from alembic import op

revision = "20260925_02"
down_revision = "20260925_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Expand providers table
    op.execute("""
        ALTER TABLE providers 
        ADD COLUMN IF NOT EXISTS video_intro_url TEXT,
        ADD COLUMN IF NOT EXISTS video_is_external BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS base_hourly_rate NUMERIC(10, 2) DEFAULT 0.00
    """)

    # 2. Create provider_portfolio table
    op.execute("""
        CREATE TABLE IF NOT EXISTS provider_portfolio (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id UUID NOT NULL REFERENCES providers(user_id) ON DELETE CASCADE,
            image_url TEXT NOT NULL,
            display_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_provider_portfolio ON provider_portfolio(provider_id, display_order)")

    # 3. Create provider_availability table for the calendar
    op.execute("""
        CREATE TABLE IF NOT EXISTS provider_availability (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id UUID NOT NULL REFERENCES providers(user_id) ON DELETE CASCADE,
            date DATE NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('open', 'booked', 'unavailable')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (provider_id, date)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_provider_availability ON provider_availability(provider_id, date)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS provider_availability")
    op.execute("DROP TABLE IF EXISTS provider_portfolio")
    op.execute("""
        ALTER TABLE providers 
        DROP COLUMN IF EXISTS video_intro_url,
        DROP COLUMN IF EXISTS video_is_external,
        DROP COLUMN IF EXISTS base_hourly_rate
    """)
