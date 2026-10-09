"""Support secure role completion after social signup."""
from alembic import op

revision = "20260807_12"
down_revision = "20260807_11"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("""CREATE TABLE IF NOT EXISTS auth_role_tokens (
      role_token VARCHAR(255) PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS auth_role_tokens")
