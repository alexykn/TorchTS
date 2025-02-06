from fastapi import HTTPException, UploadFile
from processing.document_parser import parse_document
from sqlalchemy.orm import Session
from storage.models import engine, Profile, File as DBFile

def list_profile_files_service(profile_id: int):
    with Session(engine) as session:
        files = session.query(DBFile).filter_by(profile_id=profile_id).all()
        return [{
            "id": f.id,
            "filename": f.filename,
            "file_type": f.file_type,
            "pages": f.pages,
            "created_at": f.created_at
        } for f in files]

async def upload_profile_file_service(profile_id: int, file: UploadFile):
    with Session(engine) as session:
        profile = session.query(Profile).filter_by(id=profile_id).first()
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
                pages=pages
            )
            session.add(db_file)
            session.commit()
            return {
                "id": db_file.id,
                "filename": db_file.filename,
                "file_type": db_file.file_type,
                "content": text,
                "pages": db_file.pages,
                "created_at": db_file.created_at
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

def get_profile_file_service(profile_id: int, file_id: int):
    with Session(engine) as session:
        profile = session.query(Profile).filter_by(id=profile_id).first()
        if not profile:
            raise HTTPException(404, "Profile not found")
        file = session.query(DBFile).filter_by(id=file_id, profile_id=profile_id).first()
        if not file:
            raise HTTPException(404, "File not found")
        return {
            "id": file.id,
            "filename": file.filename,
            "file_type": file.file_type,
            "content": file.content,
            "pages": file.pages,
            "created_at": file.created_at
        }

def delete_profile_file_service(profile_id: int, file_id: int):
    with Session(engine) as session:
        profile = session.query(Profile).filter_by(id=profile_id).first()
        if not profile:
            raise HTTPException(404, "Profile not found")
        file = session.query(DBFile).filter_by(id=file_id, profile_id=profile_id).first()
        if not file:
            raise HTTPException(404, "File not found")
        session.delete(file)
        session.commit()
        return {"message": "File deleted successfully"}

def delete_all_profile_files_service(profile_id: int):
    with Session(engine) as session:
        profile = session.query(Profile).filter_by(id=profile_id).first()
        if not profile:
            raise HTTPException(404, "Profile not found")
        session.query(DBFile).filter_by(profile_id=profile_id).delete()
        session.commit()
        return {"message": "All files deleted successfully"}

async def upload_file_service(file: UploadFile):
    content = await file.read()
    file_ext = file.filename.lower().split('.')[-1]
    
    try:
        text, pages = parse_document(content, file_ext)
        return {"text": text, "pages": pages}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}") 