"""Add proposal-room messages and activity tracking support."""
from alembic import op

revision = "20260907_15"
down_revision = "20260905_14"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""CREATE TABLE IF NOT EXISTS custom_request_bid_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bid_id UUID NOT NULL REFERENCES custom_request_bids(id) ON DELETE CASCADE,
      sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL CHECK(length(trim(body)) > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMPTZ
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_custom_bid_messages_bid_created ON custom_request_bid_messages(bid_id,created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_custom_bid_messages_sender ON custom_request_bid_messages(sender_user_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS custom_request_bid_messages")