"""Create authentication tables."""
from alembic import op

revision = "20260802_05"
down_revision = "20260802_04"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_oauth_id VARCHAR(255)")
    op.execute("""CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        reset_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS password_resets")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS provider_oauth_id")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS password_hash")
