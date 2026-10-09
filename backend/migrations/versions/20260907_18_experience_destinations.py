"""Add separate tour destinations to experiences."""
from alembic import op

revision = "20260907_18"
down_revision = "20260907_17"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE experiences ADD COLUMN IF NOT EXISTS destination TEXT")
    op.execute("UPDATE experiences SET destination = meeting_address WHERE destination IS NULL OR trim(destination) = ''")
    op.execute("ALTER TABLE experiences ALTER COLUMN destination SET NOT NULL")
    op.execute("ALTER TABLE experiences ADD CONSTRAINT experiences_destination_not_empty CHECK (length(trim(destination)) > 0)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_experiences_destination ON experiences(destination)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_experiences_destination")
    op.execute("ALTER TABLE experiences DROP CONSTRAINT IF EXISTS experiences_destination_not_empty")
    op.execute("ALTER TABLE experiences DROP COLUMN IF EXISTS destination")