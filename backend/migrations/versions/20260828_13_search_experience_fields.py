"""Add search-filter fields to experiences: group_type, activity_level, themes, time_of_day, is_instant_book, is_accessible."""
from alembic import op

revision = "20260828_13"
down_revision = "20260807_12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
          CREATE TYPE group_type_enum AS ENUM ('private', 'group', 'both');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
          CREATE TYPE activity_level_enum AS ENUM ('minimal', 'moderate', 'high');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("ALTER TABLE experiences ADD COLUMN IF NOT EXISTS group_type group_type_enum NOT NULL DEFAULT 'both'")
    op.execute("ALTER TABLE experiences ADD COLUMN IF NOT EXISTS activity_level activity_level_enum NOT NULL DEFAULT 'moderate'")
    op.execute("ALTER TABLE experiences ADD COLUMN IF NOT EXISTS is_accessible BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE experiences ADD COLUMN IF NOT EXISTS is_instant_book BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE experiences ADD COLUMN IF NOT EXISTS themes JSONB NOT NULL DEFAULT '[]'::jsonb")
    op.execute("ALTER TABLE experiences ADD COLUMN IF NOT EXISTS time_of_day JSONB NOT NULL DEFAULT '[]'::jsonb")
    op.execute("CREATE INDEX IF NOT EXISTS idx_experiences_group_type ON experiences(group_type)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_experiences_instant_book ON experiences(is_instant_book) WHERE is_instant_book")


def downgrade() -> None:
    op.execute("ALTER TABLE experiences DROP COLUMN IF EXISTS time_of_day")
    op.execute("ALTER TABLE experiences DROP COLUMN IF EXISTS themes")
    op.execute("ALTER TABLE experiences DROP COLUMN IF EXISTS is_instant_book")
    op.execute("ALTER TABLE experiences DROP COLUMN IF EXISTS is_accessible")
    op.execute("ALTER TABLE experiences DROP COLUMN IF EXISTS activity_level")
    op.execute("ALTER TABLE experiences DROP COLUMN IF EXISTS group_type")
    op.execute("DROP TYPE IF EXISTS activity_level_enum")
    op.execute("DROP TYPE IF EXISTS group_type_enum")
