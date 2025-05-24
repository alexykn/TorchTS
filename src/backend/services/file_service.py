from fastapi import HTTPException, UploadFile
from processing.document_parser import parse_document
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from storage.models import (
    engine,
    Profile,
    File as DBFile,
    ASYNC_DB,
    AsyncSessionLocal,
)
import asyncio

async def list_profile_files_service(profile_id: int):
    if ASYNC_DB and AsyncSessionLocal:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(DBFile).where(DBFile.profile_id == profile_id)
            )
            files = result.scalars().all()
            return [
                {
                    "id": f.id,
                    "filename": f.filename,
                    "file_type": f.file_type,
                    "pages": f.pages,
                    "created_at": f.created_at,
                }
                for f in files
            ]
    else:
        def _sync_op():
            with Session(engine) as session:
                files = session.query(DBFile).filter_by(profile_id=profile_id).all()
                return [
                    {
                        "id": f.id,
                        "filename": f.filename,
                        "file_type": f.file_type,
                        "pages": f.pages,
                        "created_at": f.created_at,
                    }
                    for f in files
                ]

        return await asyncio.to_thread(_sync_op)

async def upload_profile_file_service(profile_id: int, file: UploadFile):
    if ASYNC_DB and AsyncSessionLocal:
        async with AsyncSessionLocal() as session:
            profile = await session.get(Profile, profile_id)
            if not profile:
                raise HTTPException(404, "Profile not found")

            content = await file.read()
            file_ext = file.filename.lower().split('.')[-1]

            try:
                text, pages = parse_document(content, file_ext)
                db_file = DBFile(
                    profile_id=profile_id,
                    filename=file.filename,
                    file_type=file_ext,
                    content=text,
                    pages=pages,
                )
                session.add(db_file)
                await session.commit()
                await session.refresh(db_file)
                return {
                    "id": db_file.id,
                    "filename": db_file.filename,
                    "file_type": db_file.file_type,
                    "content": text,
                    "pages": db_file.pages,
                    "created_at": db_file.created_at,
                }
            except Exception as e:
                await session.rollback()
                raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")
    else:
        content = await file.read()
        file_ext = file.filename.lower().split('.')[-1]

        def _sync_db():
            with Session(engine) as session:
                profile = session.query(Profile).filter_by(id=profile_id).first()
                if not profile:
                    raise HTTPException(404, "Profile not found")
                try:
                    text, pages = parse_document(content, file_ext)
                    db_file = DBFile(
                        profile_id=profile_id,
                        filename=file.filename,
                        file_type=file_ext,
                        content=text,
                        pages=pages,
                    )
                    session.add(db_file)
                    session.commit()
                    return {
                        "id": db_file.id,
                        "filename": db_file.filename,
                        "file_type": db_file.file_type,
                        "content": text,
                        "pages": db_file.pages,
                        "created_at": db_file.created_at,
                    }
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

        return await asyncio.to_thread(_sync_db)

async def get_profile_file_service(profile_id: int, file_id: int):
    if ASYNC_DB and AsyncSessionLocal:
        async with AsyncSessionLocal() as session:
            profile = await session.get(Profile, profile_id)
            if not profile:
                raise HTTPException(404, "Profile not found")
            result = await session.execute(
                select(DBFile).where(
                    DBFile.id == file_id, DBFile.profile_id == profile_id
                )
            )
            file_obj = result.scalars().first()
            if not file_obj:
                raise HTTPException(404, "File not found")
            return {
                "id": file_obj.id,
                "filename": file_obj.filename,
                "file_type": file_obj.file_type,
                "content": file_obj.content,
                "pages": file_obj.pages,
                "created_at": file_obj.created_at,
            }
    else:
        def _sync_op():
            with Session(engine) as session:
                profile = session.query(Profile).filter_by(id=profile_id).first()
                if not profile:
                    raise HTTPException(404, "Profile not found")
                file_obj = session.query(DBFile).filter_by(id=file_id, profile_id=profile_id).first()
                if not file_obj:
                    raise HTTPException(404, "File not found")
                return {
                    "id": file_obj.id,
                    "filename": file_obj.filename,
                    "file_type": file_obj.file_type,
                    "content": file_obj.content,
                    "pages": file_obj.pages,
                    "created_at": file_obj.created_at,
                }

        return await asyncio.to_thread(_sync_op)

async def delete_profile_file_service(profile_id: int, file_id: int):
    if ASYNC_DB and AsyncSessionLocal:
        async with AsyncSessionLocal() as session:
            profile = await session.get(Profile, profile_id)
            if not profile:
                raise HTTPException(404, "Profile not found")
            result = await session.execute(
                select(DBFile).where(DBFile.id == file_id, DBFile.profile_id == profile_id)
            )
            file_obj = result.scalars().first()
            if not file_obj:
                raise HTTPException(404, "File not found")
            await session.delete(file_obj)
            await session.commit()
            return {"message": "File deleted successfully"}
    else:
        def _sync_op():
            with Session(engine) as session:
                profile = session.query(Profile).filter_by(id=profile_id).first()
                if not profile:
                    raise HTTPException(404, "Profile not found")
                file_obj = session.query(DBFile).filter_by(id=file_id, profile_id=profile_id).first()
                if not file_obj:
                    raise HTTPException(404, "File not found")
                session.delete(file_obj)
                session.commit()
                return {"message": "File deleted successfully"}

        return await asyncio.to_thread(_sync_op)

async def delete_all_profile_files_service(profile_id: int):
    if ASYNC_DB and AsyncSessionLocal:
        async with AsyncSessionLocal() as session:
            profile = await session.get(Profile, profile_id)
            if not profile:
                raise HTTPException(404, "Profile not found")
            await session.execute(
                delete(DBFile).where(DBFile.profile_id == profile_id)
            )
            await session.commit()
            return {"message": "All files deleted successfully"}
    else:
        def _sync_op():
            with Session(engine) as session:
                profile = session.query(Profile).filter_by(id=profile_id).first()
                if not profile:
                    raise HTTPException(404, "Profile not found")
                session.query(DBFile).filter_by(profile_id=profile_id).delete()
                session.commit()
                return {"message": "All files deleted successfully"}

        return await asyncio.to_thread(_sync_op)

async def upload_file_service(file: UploadFile):
    content = await file.read()
    file_ext = file.filename.lower().split('.')[-1]
    
    try:
        text, pages = parse_document(content, file_ext)
        return {"text": text, "pages": pages}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}") 