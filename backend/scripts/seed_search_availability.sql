INSERT INTO experience_availability (experience_id, available_date, available_spots, is_available)
SELECT e.id, day::date, e.max_capacity, TRUE
FROM experiences e
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', INTERVAL '1 day') AS day
WHERE e.is_published = TRUE
ON CONFLICT (experience_id, available_date) DO NOTHING;
