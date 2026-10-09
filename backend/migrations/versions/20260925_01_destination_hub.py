"""Add destination intel and highlights for destination hub."""
from alembic import op

revision = "20260925_01"
down_revision = "20260907_18"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Expand tour_locations to include destination hub intel data
    op.execute("""
        ALTER TABLE tour_locations 
        ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
        ADD COLUMN IF NOT EXISTS weather_summary TEXT,
        ADD COLUMN IF NOT EXISTS best_time_to_visit TEXT,
        ADD COLUMN IF NOT EXISTS currency_info TEXT,
        ADD COLUMN IF NOT EXISTS visa_info TEXT,
        ADD COLUMN IF NOT EXISTS languages TEXT,
        ADD COLUMN IF NOT EXISTS timezone TEXT,
        ADD COLUMN IF NOT EXISTS safety_status TEXT,
        ADD COLUMN IF NOT EXISTS emergency_numbers TEXT,
        ADD COLUMN IF NOT EXISTS getting_around_editorial TEXT,
        ADD COLUMN IF NOT EXISTS best_time_editorial TEXT
    """)

    # 2. Create destination_highlights table for "Things to do"
    op.execute("""
        CREATE TABLE IF NOT EXISTS destination_highlights (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            location_id UUID NOT NULL REFERENCES tour_locations(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            image_url TEXT,
            tag_native TEXT,
            tag_info TEXT,
            meta_info TEXT,
            price TEXT,
            is_free BOOLEAN DEFAULT FALSE,
            display_order INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_dest_highlights_loc ON destination_highlights(location_id, display_order)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS destination_highlights")
    op.execute("""
        ALTER TABLE tour_locations 
        DROP COLUMN IF EXISTS hero_image_url,
        DROP COLUMN IF EXISTS weather_summary,
        DROP COLUMN IF EXISTS best_time_to_visit,
        DROP COLUMN IF EXISTS currency_info,
        DROP COLUMN IF EXISTS visa_info,
        DROP COLUMN IF EXISTS languages,
        DROP COLUMN IF EXISTS timezone,
        DROP COLUMN IF EXISTS safety_status,
        DROP COLUMN IF EXISTS emergency_numbers,
        DROP COLUMN IF EXISTS getting_around_editorial,
        DROP COLUMN IF EXISTS best_time_editorial
    """)
