UPDATE providers SET public_slug='maria', bio='Born and raised in Cebu, I share island culture, hidden landmarks, local food, and honest community stories with travelers from around the world.', cover_url='https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=1200&q=80',
  video_intro_url='https://images.unsplash.com/photo-1528183429752-a97d0ef99f5c?w=600&q=80', base_address='Cebu, Philippines',
  hourly_rate=45, years_experience=8 WHERE id='019102f5-7c00-7000-8000-000000000002';
UPDATE users SET avatar_url='https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80' WHERE id='019102f5-7c00-7000-8000-000000000001';

INSERT INTO users(id,email,first_name,last_name,avatar_url,primary_role,account_status) VALUES
('019102f5-7c00-7000-8000-000000000021','kenji.local@guideverse.test','Kenji','Tanaka','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80','provider','active')
ON CONFLICT(id) DO NOTHING;
INSERT INTO providers(id,user_id,public_slug,business_name,bio,identity_verified,currency,cover_url,video_intro_url,base_address,hourly_rate,years_experience) VALUES
('019102f5-7c00-7000-8000-000000000022','019102f5-7c00-7000-8000-000000000021','kenji','Kenji Kyoto Experiences','Temple historian and food enthusiast. I reveal Kyoto beyond the guidebooks through thoughtful walks, hidden neighborhood stories, and authentic local encounters.',TRUE,'USD','https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1200&q=80','https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=600&q=80','Kyoto, Japan',60,12)
ON CONFLICT(id) DO UPDATE SET public_slug=EXCLUDED.public_slug;
INSERT INTO provider_trust_scores(provider_id,trust_score,total_reviews,average_rating) VALUES
('019102f5-7c00-7000-8000-000000000022',4.90,512,4.80) ON CONFLICT(provider_id) DO NOTHING;
INSERT INTO provider_languages(provider_id,language_code) VALUES
('019102f5-7c00-7000-8000-000000000022','EN'),('019102f5-7c00-7000-8000-000000000022','JP') ON CONFLICT DO NOTHING;
INSERT INTO provider_category_mappings(provider_id,category_id)
SELECT '019102f5-7c00-7000-8000-000000000022',id FROM provider_categories WHERE name='Local Expert' ON CONFLICT DO NOTHING;
INSERT INTO provider_category_mappings(provider_id,category_id)
SELECT '019102f5-7c00-7000-8000-000000000002',id FROM provider_categories WHERE name='Tour Guide' ON CONFLICT DO NOTHING;
INSERT INTO provider_portfolio_media(provider_id,url,sort_order) VALUES
('019102f5-7c00-7000-8000-000000000022','https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=800&q=80',0),
('019102f5-7c00-7000-8000-000000000022','https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80',1)
ON CONFLICT(provider_id,sort_order) DO NOTHING;
