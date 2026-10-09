"""Support tokenized Stripe and PayPal payment methods."""
from alembic import op

revision = "20260807_07"
down_revision = "20260804_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE traveler_payment_methods ALTER COLUMN last4 DROP NOT NULL")
    op.execute("ALTER TABLE traveler_payment_methods ADD COLUMN IF NOT EXISTS display_label VARCHAR(160)")
    op.execute("ALTER TABLE traveler_payment_methods ADD COLUMN IF NOT EXISTS provider_customer_id VARCHAR(255)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_traveler_payment_provider_token ON traveler_payment_methods(provider, provider_payment_method_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_traveler_payment_provider_token")
    op.execute("ALTER TABLE traveler_payment_methods DROP COLUMN IF EXISTS provider_customer_id")
    op.execute("ALTER TABLE traveler_payment_methods DROP COLUMN IF EXISTS display_label")
