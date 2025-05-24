try:  # pragma: no cover - optional SQLAlchemy
    from sqlalchemy import select
    from sqlalchemy.orm import Session
except Exception:  # pragma: no cover - missing dependency
    select = None
    Session = None

from storage.models import (
    engine,
    Profile,
    ASYNC_DB,
    AsyncSessionLocal,
    SA_AVAILABLE,
)
from sqlite3 import IntegrityError
from fastapi import HTTPException
import asyncio

async def create_profile_service(profile):
    if not SA_AVAILABLE or engine is None:
        raise RuntimeError("SQLAlchemy is not available")
    if ASYNC_DB and AsyncSessionLocal:
        async with AsyncSessionLocal() as session:
            db_profile = Profile(
                name=profile.name,
                voice_preset=profile.voice_preset,
                volume=profile.volume,
            )
            session.add(db_profile)
            try:
                await session.commit()
                await session.refresh(db_profile)
                return {
                    "id": db_profile.id,
                    "name": db_profile.name,
                    "voice_preset": db_profile.voice_preset,
                    "volume": db_profile.volume,
                    "created_at": db_profile.created_at,
                }
            except IntegrityError:
                await session.rollback()
                raise HTTPException(400, "Profile name already exists")
    else:
        def _sync_op():
            with Session(engine) as session:
                db_profile = Profile(
                    name=profile.name,
                    voice_preset=profile.voice_preset,
                    volume=profile.volume,
                )
                session.add(db_profile)
                try:
                    session.commit()
                    return {
                        "id": db_profile.id,
                        "name": db_profile.name,
                        "voice_preset": db_profile.voice_preset,
                        "volume": db_profile.volume,
                        "created_at": db_profile.created_at,
                    }
                except IntegrityError:
                    session.rollback()
                    raise HTTPException(400, "Profile name already exists")

        return await asyncio.to_thread(_sync_op)

async def list_profiles_service():
    if not SA_AVAILABLE or engine is None:
        raise RuntimeError("SQLAlchemy is not available")
    if ASYNC_DB and AsyncSessionLocal:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Profile))
            profiles = result.scalars().all()
            return [
                {
                    "id": p.id,
                    "name": p.name,
                    "voice_preset": p.voice_preset,
                    "volume": p.volume,
                    "created_at": p.created_at,
                }
                for p in profiles
            ]
    else:
        def _sync_op():
            with Session(engine) as session:
                profiles = session.query(Profile).all()
                return [
                    {
                        "id": p.id,
                        "name": p.name,
                        "voice_preset": p.voice_preset,
                        "volume": p.volume,
                        "created_at": p.created_at,
                    }
                    for p in profiles
                ]

        return await asyncio.to_thread(_sync_op)

async def delete_profile_service(profile_id: int):
    if not SA_AVAILABLE or engine is None:
        raise RuntimeError("SQLAlchemy is not available")
    if ASYNC_DB and AsyncSessionLocal:
        async with AsyncSessionLocal() as session:
            result = await session.get(Profile, profile_id)
            if not result:
                raise HTTPException(404, "Profile not found")
            await session.delete(result)
            await session.commit()
            return {"message": "Profile deleted successfully"}
    else:
        def _sync_op():
            with Session(engine) as session:
                profile = session.query(Profile).filter_by(id=profile_id).first()
                if not profile:
                    raise HTTPException(404, "Profile not found")
                session.delete(profile)
                session.commit()
                return {"message": "Profile deleted successfully"}

        return await asyncio.to_thread(_sync_op)
