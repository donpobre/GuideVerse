# GuideVerse PostgreSQL API

Prerequisites: PostgreSQL 16 with PostGIS and pgvector available, plus the foundational `users`, `providers`, `provider_categories`, `provider_trust_scores`, and `reviews` tables from the architecture document.

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

For local development, create the administrator account with:

```powershell
python scripts/create_admin.py
```

Default admin credentials:

```text
Email: admin@guideverse.local
Password: Admin@12345!
```

Override them with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, and
`ADMIN_LAST_NAME` environment variables when needed. Do not use the default
password outside local development.

The Vite dev server proxies `/api` to port 8000. Public experience URLs can use either the UUID or the unique slug, so the current `/experience/1` route works when an experience has `slug = '1'`.

For the bundled local database, run `docker compose up -d postgres`, migrate, then seed with:

```powershell
Get-Content scripts/seed_local.sql | docker exec -i guideverse-postgres psql -U guideverse -d guideverse
```

`experience_price_group.number_of_person` accepts an exact count (`"2"`) or range (`"3-5"`). Its `base_price` is the price per person for that group-size band. If no group matches, the app uses `experiences.base_price` per person.
