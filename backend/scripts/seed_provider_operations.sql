INSERT INTO users(id,email,first_name,last_name,primary_role,account_status) VALUES
('019102f5-7c00-7000-8000-000000000031','traveler.local@guideverse.test','John','Doe','traveler','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO provider_instant_availability(provider_id,is_available_now,available_until) VALUES
('019102f5-7c00-7000-8000-000000000002',TRUE,CURRENT_TIMESTAMP+INTERVAL '8 hours') ON CONFLICT(provider_id) DO NOTHING;
INSERT INTO provider_payout_settings(provider_id,payout_schedule,account_connected,last_payout_failed) VALUES
('019102f5-7c00-7000-8000-000000000002','weekly',TRUE,FALSE) ON CONFLICT(provider_id) DO NOTHING;
INSERT INTO custom_requests(id,traveler_id,title,destination_name,start_date,end_date,group_size,budget_max,currency,description,vibe_tags,status,created_at) VALUES
('019102f5-7c00-7000-8000-000000000041','019102f5-7c00-7000-8000-000000000031','Family-friendly Cebu discovery','Cebu',CURRENT_DATE+10,CURRENT_DATE+11,4,450,'USD','A relaxed family day with culture, food, and easy pacing.','["Family","Food","Culture"]','open',CURRENT_TIMESTAMP-INTERVAL '2 hours') ON CONFLICT(id) DO NOTHING;
INSERT INTO bookings(id,booking_reference,traveler_id,provider_id,experience_id,title,start_time,end_time,participant_count,gross_amount,platform_fee,net_provider_payout,currency,status) SELECT
'019102f5-7c00-7000-8000-000000000051','GV-LOCAL-001','019102f5-7c00-7000-8000-000000000031','019102f5-7c00-7000-8000-000000000002',e.id,e.title,CURRENT_DATE+TIME '09:00',CURRENT_DATE+TIME '12:00',2,300,33,267,'USD','confirmed'
FROM experiences e WHERE e.provider_id='019102f5-7c00-7000-8000-000000000002' ORDER BY e.created_at LIMIT 1 ON CONFLICT(id) DO NOTHING;
INSERT INTO escrow_ledgers(id,booking_id,amount_held,currency,status,release_scheduled_at) VALUES
('019102f5-7c00-7000-8000-000000000061','019102f5-7c00-7000-8000-000000000051',300,'USD','held',CURRENT_TIMESTAMP+INTERVAL '2 days') ON CONFLICT(id) DO NOTHING;
INSERT INTO conversations(id,traveler_id,provider_id,booking_id,subject) VALUES
('019102f5-7c00-7000-8000-000000000071','019102f5-7c00-7000-8000-000000000031','019102f5-7c00-7000-8000-000000000002','019102f5-7c00-7000-8000-000000000051','Cebu experience details') ON CONFLICT(id) DO NOTHING;
INSERT INTO conversation_messages(id,conversation_id,sender_user_id,body,created_at) VALUES
('019102f5-7c00-7000-8000-000000000081','019102f5-7c00-7000-8000-000000000071','019102f5-7c00-7000-8000-000000000031','Hello! Where should we meet for the experience?',CURRENT_TIMESTAMP-INTERVAL '30 minutes'),
('019102f5-7c00-7000-8000-000000000082','019102f5-7c00-7000-8000-000000000071','019102f5-7c00-7000-8000-000000000001','We will meet at the main entrance of Ayala Center Cebu.',CURRENT_TIMESTAMP-INTERVAL '20 minutes') ON CONFLICT(id) DO NOTHING;
