"""Track external booking payment attempts."""
from alembic import op

revision = "20260807_08"
down_revision = "20260807_07"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("""CREATE TABLE IF NOT EXISTS booking_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      payment_method_id UUID REFERENCES traveler_payment_methods(id) ON DELETE SET NULL,
      provider VARCHAR(30) NOT NULL, external_payment_id VARCHAR(255), amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, external_payment_id))""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_booking_payments_booking ON booking_payments(booking_id)")

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS booking_payments")
