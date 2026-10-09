"""Add admin-managed tour locations."""
from alembic import op

revision = "20260907_17"
down_revision = "20260907_16"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""CREATE TABLE IF NOT EXISTS tour_locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE CHECK(length(trim(name)) > 0),
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_tour_locations_order ON tour_locations(display_order, name)")
    op.execute("""INSERT INTO tour_locations (name, display_order) VALUES
      ('Kyoto, Japan', 1),
      ('Cebu, Philippines', 2),
      ('Santorini, Greece', 3),
      ('Bali, Indonesia', 4),
      ('Paris, France', 5),
      ('Istanbul, Turkey', 6),
      ('Cusco, Peru', 7),
      ('Marrakech, Morocco', 8)
      ON CONFLICT (name) DO NOTHING""")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS tour_locations")