from sqlalchemy.orm import Session
from storage.models import engine, Profile
from sqlite3 import IntegrityError
from fastapi import HTTPException

def create_profile_service(profile):
    with Session(engine) as session:
        db_profile = Profile(
            name=profile.name,
            voice_preset=profile.voice_preset,
            volume=profile.volume
        )
        session.add(db_profile)
        try:
            session.commit()
            return {
                "id": db_profile.id,
                "name": db_profile.name,
                "voice_preset": db_profile.voice_preset,
                "volume": db_profile.volume,
                "created_at": db_profile.created_at
            }
        except IntegrityError:
            raise HTTPException(400, "Profile name already exists")

def list_profiles_service():
    with Session(engine) as session:
        profiles = session.query(Profile).all()
        return [{
            "id": p.id,
            "name": p.name,
            "voice_preset": p.voice_preset,
            "volume": p.volume,
            "created_at": p.created_at
        } for p in profiles]

def delete_profile_service(profile_id: int):
    with Session(engine) as session:
        profile = session.query(Profile).filter_by(id=profile_id).first()
        if not profile:
            raise HTTPException(404, "Profile not found")
        session.delete(profile)
        session.commit()
        return {"message": "Profile deleted successfully"} 