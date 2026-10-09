"""Add searchable provider languages and dated experience availability."""
from alembic import op

revision = "20260802_02"
down_revision = "20260802_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS provider_languages (
            provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
            language_code VARCHAR(10) NOT NULL,
            PRIMARY KEY (provider_id, language_code)
        )
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS experience_availability (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
            available_date DATE NOT NULL,
            available_spots INT NOT NULL CHECK (available_spots >= 0),
            is_available BOOLEAN NOT NULL DEFAULT TRUE,
            UNIQUE (experience_id, available_date)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_availability_date ON experience_availability(available_date, experience_id) WHERE is_available AND available_spots > 0")
    op.execute("CREATE INDEX IF NOT EXISTS idx_experience_title_lower ON experiences(lower(title))")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS experience_availability")
    op.execute("DROP TABLE IF EXISTS provider_languages")
