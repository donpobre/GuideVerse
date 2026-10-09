"""Store private or group preference on custom requests."""
from alembic import op

revision = "20260905_14"
down_revision = "20260828_13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS group_type VARCHAR(20) NOT NULL DEFAULT 'private'")
    op.execute("ALTER TABLE custom_requests ADD CONSTRAINT custom_requests_group_type_check CHECK (group_type IN ('private','group'))")


def downgrade() -> None:
    op.execute("ALTER TABLE custom_requests DROP CONSTRAINT IF EXISTS custom_requests_group_type_check")
    op.execute("ALTER TABLE custom_requests DROP COLUMN IF EXISTS group_type")