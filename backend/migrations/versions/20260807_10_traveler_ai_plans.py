"""Persist traveler AI itinerary generations."""
from alembic import op

revision = "20260807_10"
down_revision = "20260807_09"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("""CREATE TABLE IF NOT EXISTS traveler_ai_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), traveler_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL, itinerary JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS traveler_ai_plans")
