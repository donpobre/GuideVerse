"""Add public provider profile fields and portfolio support."""
from alembic import op

revision = "20260802_03"
down_revision = "20260802_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE providers ADD COLUMN IF NOT EXISTS public_slug VARCHAR(100)")
    op.execute("ALTER TABLE providers ADD COLUMN IF NOT EXISTS cover_url TEXT")
    op.execute("ALTER TABLE providers ADD COLUMN IF NOT EXISTS video_intro_url TEXT")
    op.execute("ALTER TABLE providers ADD COLUMN IF NOT EXISTS base_address VARCHAR(255)")
    op.execute("ALTER TABLE providers ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2)")
    op.execute("ALTER TABLE providers ADD COLUMN IF NOT EXISTS years_experience INT NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_accepting_custom_requests BOOLEAN NOT NULL DEFAULT TRUE")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_providers_public_slug ON providers(public_slug) WHERE public_slug IS NOT NULL")
    op.execute("""
        CREATE TABLE IF NOT EXISTS provider_category_mappings (
            provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            category_id UUID NOT NULL REFERENCES provider_categories(id) ON DELETE CASCADE,
            PRIMARY KEY (provider_id, category_id)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS provider_portfolio_media (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            url TEXT NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            UNIQUE(provider_id, sort_order)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS provider_portfolio_media")
    op.execute("DROP TABLE IF EXISTS provider_category_mappings")
    op.execute("DROP INDEX IF EXISTS uq_providers_public_slug")
    for column in ("is_accepting_custom_requests", "years_experience", "hourly_rate", "base_address", "video_intro_url", "cover_url", "public_slug"):
        op.execute(f"ALTER TABLE providers DROP COLUMN IF EXISTS {column}")
