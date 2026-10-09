"""Create provider dashboard, calendar, bids, messages, and earnings tables."""
from alembic import op

revision = "20260802_04"
down_revision = "20260802_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE provider_trust_scores ADD COLUMN IF NOT EXISTS response_rate_pct DECIMAL(5,2) NOT NULL DEFAULT 100.00")
    op.execute("ALTER TABLE experience_availability ADD COLUMN IF NOT EXISTS surge_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00")
    op.execute("""CREATE TABLE IF NOT EXISTS provider_instant_availability (
      provider_id UUID PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
      is_available_now BOOLEAN NOT NULL DEFAULT FALSE,
      available_until TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    op.execute("""CREATE TABLE IF NOT EXISTS custom_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), traveler_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL, destination_name VARCHAR(255) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
      group_size INT NOT NULL CHECK(group_size>0), budget_max DECIMAL(10,2) NOT NULL CHECK(budget_max>0), currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      description TEXT NOT NULL, vibe_tags JSONB NOT NULL DEFAULT '[]'::jsonb, status VARCHAR(30) NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(end_date>=start_date))""")
    op.execute("""CREATE TABLE IF NOT EXISTS custom_request_bids (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID NOT NULL REFERENCES custom_requests(id) ON DELETE CASCADE,
      provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE, proposed_itinerary TEXT NOT NULL,
      quoted_price DECIMAL(10,2) NOT NULL CHECK(quoted_price>0), currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      portfolio_experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(request_id,provider_id))""")
    op.execute("""CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), booking_reference VARCHAR(30) UNIQUE NOT NULL,
      traveler_id UUID NOT NULL REFERENCES users(id), provider_id UUID NOT NULL REFERENCES providers(id),
      experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL, title VARCHAR(255) NOT NULL,
      start_time TIMESTAMPTZ NOT NULL, end_time TIMESTAMPTZ NOT NULL, participant_count INT NOT NULL CHECK(participant_count>0),
      gross_amount DECIMAL(10,2) NOT NULL, platform_fee DECIMAL(10,2) NOT NULL, net_provider_payout DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD', status VARCHAR(30) NOT NULL DEFAULT 'confirmed', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bookings_provider_start ON bookings(provider_id,start_time)")
    op.execute("""CREATE TABLE IF NOT EXISTS escrow_ledgers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      amount_held DECIMAL(10,2) NOT NULL, currency VARCHAR(3) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'held',
      release_scheduled_at TIMESTAMPTZ, released_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    op.execute("""CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), traveler_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE, booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
      subject VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    op.execute("""CREATE TABLE IF NOT EXISTS conversation_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_user_id UUID NOT NULL REFERENCES users(id), body TEXT NOT NULL CHECK(length(body)>0), read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON conversation_messages(conversation_id,created_at)")
    op.execute("""CREATE TABLE IF NOT EXISTS provider_payout_settings (
      provider_id UUID PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE, payout_schedule VARCHAR(20) NOT NULL DEFAULT 'weekly',
      account_connected BOOLEAN NOT NULL DEFAULT FALSE, last_payout_failed BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)""")


def downgrade() -> None:
    for table in ("provider_payout_settings","conversation_messages","conversations","escrow_ledgers","bookings","custom_request_bids","custom_requests","provider_instant_availability"):
        op.execute(f"DROP TABLE IF EXISTS {table}")
    op.execute("ALTER TABLE experience_availability DROP COLUMN IF EXISTS surge_multiplier")
    op.execute("ALTER TABLE provider_trust_scores DROP COLUMN IF EXISTS response_rate_pct")
