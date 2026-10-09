"""Add flexible request dates, proposal revisions, and moderation flags."""
from alembic import op

revision = "20260907_16"
down_revision = "20260907_15"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE custom_requests ADD COLUMN IF NOT EXISTS dates_flexible BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE custom_request_bids ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("""CREATE TABLE IF NOT EXISTS custom_request_bid_revisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bid_id UUID NOT NULL REFERENCES custom_request_bids(id) ON DELETE CASCADE,
      changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quoted_price DECIMAL(10,2) NOT NULL CHECK(quoted_price>0), proposed_itinerary TEXT NOT NULL,
      change_summary TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_custom_bid_revisions_bid_created ON custom_request_bid_revisions(bid_id,created_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS custom_request_bid_revisions")
    op.execute("ALTER TABLE custom_request_bids DROP COLUMN IF EXISTS is_hidden")
    op.execute("ALTER TABLE custom_requests DROP COLUMN IF EXISTS dates_flexible")