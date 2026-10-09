INSERT INTO users (id, email, first_name, last_name, primary_role, account_status)
VALUES ('019102f5-7c00-7000-8000-000000000001', 'maria.local@guideverse.test', 'Maria', 'Santos', 'provider', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO providers (id, user_id, business_name, bio, identity_verified)
VALUES ('019102f5-7c00-7000-8000-000000000002', '019102f5-7c00-7000-8000-000000000001', 'Maria Local Experiences', 'Local development provider', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO provider_languages (provider_id, language_code) VALUES
('019102f5-7c00-7000-8000-000000000002', 'EN'),
('019102f5-7c00-7000-8000-000000000002', 'TL')
ON CONFLICT DO NOTHING;

INSERT INTO provider_trust_scores (provider_id, trust_score, total_reviews, average_rating)
VALUES ('019102f5-7c00-7000-8000-000000000002', 4.80, 0, 4.80)
ON CONFLICT (provider_id) DO NOTHING;

INSERT INTO provider_categories (id, slug, name, description) VALUES
('019102f5-7c00-7000-8000-000000000010', 'tour-guide', 'Tour Guide', 'Guided tours and local interpretation'),
('019102f5-7c00-7000-8000-000000000011', 'local-expert', 'Local Expert', 'Specialist local services and expertise'),
('019102f5-7c00-7000-8000-000000000012', 'experience-host', 'Experience Host', 'Hosted activities, workshops, and tastings')
ON CONFLICT (id) DO NOTHING;
