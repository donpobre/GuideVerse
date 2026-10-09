"""Add editable platform configuration."""
from alembic import op

revision = "20260807_09"
down_revision = "20260807_08"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("""CREATE TABLE IF NOT EXISTS platform_settings (
      setting_key VARCHAR(100) PRIMARY KEY, setting_value VARCHAR(500) NOT NULL,
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    op.execute("INSERT INTO platform_settings(setting_key,setting_value) VALUES('service_fee_rate','0.04') ON CONFLICT(setting_key) DO NOTHING")

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS platform_settings")
