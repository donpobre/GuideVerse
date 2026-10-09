"""Create traveler settings tables."""
from alembic import op

revision = "20260804_06"
down_revision = "20260802_05"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)")
    op.execute("""CREATE TABLE IF NOT EXISTS traveler_notification_preferences (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      booking BOOLEAN NOT NULL DEFAULT TRUE, messages BOOLEAN NOT NULL DEFAULT TRUE,
      safety BOOLEAN NOT NULL DEFAULT TRUE, promotions BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    op.execute("""CREATE TABLE IF NOT EXISTS traveler_emergency_contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(150) NOT NULL, phone VARCHAR(50) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    op.execute("""CREATE TABLE IF NOT EXISTS traveler_payment_methods (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider VARCHAR(30) NOT NULL DEFAULT 'manual', provider_payment_method_id VARCHAR(255),
      brand VARCHAR(40) NOT NULL, last4 CHAR(4) NOT NULL, expiry_month INT, expiry_year INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS traveler_payment_methods")
    op.execute("DROP TABLE IF EXISTS traveler_emergency_contacts")
    op.execute("DROP TABLE IF EXISTS traveler_notification_preferences")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS phone")
