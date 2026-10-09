import asyncio
from app.database import SessionLocal
from app.repositories import ExperienceRepository

async def main():
    async with SessionLocal() as session:
        data = await ExperienceRepository(session).search(
            query=None,
            categories=[],
            min_price=None,
            max_price=None,
            rating=None,
            languages=[],
            date_start=None,
            date_end=None,
            group_type=None,
            instant=None,
            themes=[],
            time_of_day=[],
            activity_level=[],
            is_accessible=None,
            min_travelers=None,
            max_travelers=None,
            duration_bucket=[],
            sort='recommended',
            page=1,
            page_size=2,
        )
        print({'total': data['total'], 'items': len(data['items']), 'facet_keys': sorted(data['facets'].keys())})

asyncio.run(main())
