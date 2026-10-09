"""Create or update the local GuideVerse administrator account.

Run from the backend directory:
    python scripts/create_admin.py

Override the defaults with environment variables when needed:
    ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME
"""

import asyncio
import os
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.repositories import AuthRepository


ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@guideverse.local").strip().lower()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@12345!")
ADMIN_FIRST_NAME = os.getenv("ADMIN_FIRST_NAME", "GuideVerse")
ADMIN_LAST_NAME = os.getenv("ADMIN_LAST_NAME", "Administrator")


async def main() -> None:
    if len(ADMIN_PASSWORD) < 8:
        raise SystemExit("ADMIN_PASSWORD must contain at least 8 characters")

    async with SessionLocal() as session:
        password_hash = AuthRepository._hash_password(ADMIN_PASSWORD)
        result = await session.execute(
            text("""
                INSERT INTO users(email, first_name, last_name, primary_role, account_status, password_hash)
                VALUES(:email, :first_name, :last_name, 'admin', 'active', :password_hash)
                ON CONFLICT(email) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    primary_role = 'admin',
                    account_status = 'active',
                    password_hash = EXCLUDED.password_hash,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id, email, primary_role
            """),
            {
                "email": ADMIN_EMAIL,
                "first_name": ADMIN_FIRST_NAME,
                "last_name": ADMIN_LAST_NAME,
                "password_hash": password_hash,
            },
        )
        admin = result.mappings().one()
        await session.commit()

    print(f"Admin account ready: {admin['email']} ({admin['primary_role']})")


if __name__ == "__main__":
    asyncio.run(main())