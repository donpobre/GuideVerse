"""Complete password reset and OAuth login flows."""
from alembic import op

revision = "20260807_11"
down_revision = "20260807_10"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(30)")
    op.execute("ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ")
    op.execute("""CREATE TABLE IF NOT EXISTS oauth_states (
      state_token VARCHAR(255) PRIMARY KEY, provider VARCHAR(30) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    op.execute("""CREATE TABLE IF NOT EXISTS auth_login_tokens (
      login_token VARCHAR(255) PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS auth_login_tokens")
    op.execute("DROP TABLE IF EXISTS oauth_states")
    op.execute("ALTER TABLE password_resets DROP COLUMN IF EXISTS used_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS oauth_provider")
