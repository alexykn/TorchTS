from sqlite3 import IntegrityError
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import numpy
import soundfile as sf
import io
from main import pipelines
from processing.text_processor import chunk_text
from processing.audio_generator import normalize_audio
from processing.document_parser import parse_document
from fastapi import FastAPI, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from storage.models import engine, Profile, File as DBFile, AudioOutput
from datetime import datetime
import os

# Create directories for stored files
os.makedirs('data/audio', exist_ok=True)
os.makedirs('data/files', exist_ok=True)

app = FastAPI(
    title="TorchTS API",
    description="Text-to-Speech API using TorchTS",
    version="1.0.0"
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5005", "http://0.0.0.0:5005"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Chunks", "X-Current-Chunk", "Content-Type", "Content-Length"]
)

class TTSRequest(BaseModel):
    text: str
    voice: str
    chunk_id: Optional[int] = 0
    speed: Optional[float] = 1.0

# Add this class for request validation
class ProfileCreate(BaseModel):
    name: str
    voice_preset: str | None = None
    volume: float = 0.7

@app.post("/profiles")
async def create_profile(profile: ProfileCreate):
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

@app.get("/profiles")
async def list_profiles():
    with Session(engine) as session:
        profiles = session.query(Profile).all()
        return [{
            "id": p.id,
            "name": p.name,
            "voice_preset": p.voice_preset,
            "volume": p.volume,
            "created_at": p.created_at
        } for p in profiles]

@app.get("/profiles/{profile_id}/files")
async def list_profile_files(profile_id: int):
    with Session(engine) as session:
        files = session.query(DBFile).filter_by(profile_id=profile_id).all()
        return [{
            "id": f.id,
            "filename": f.filename,
            "file_type": f.file_type,
            "pages": f.pages,
            "created_at": f.created_at
        } for f in files]

@app.post("/profiles/{profile_id}/files")
async def upload_profile_file(profile_id: int, file: UploadFile = File(...)):
    try:
        # Create database session
        with Session(engine) as session:
            # Verify profile exists
            profile = session.query(Profile).filter_by(id=profile_id).first()
            if not profile:
                raise HTTPException(404, "Profile not found")
            
            # Read and process file content
            content = await file.read()
            file_ext = file.filename.lower().split('.')[-1]
            
            try:
                # Use existing parse_document function
                text, pages = parse_document(content, file_ext)
                
                # Create new file record
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
                raise HTTPException(
                    status_code=400,
                    detail=f"Error processing file: {str(e)}"
                )
                
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Server error: {str(e)}"
        )

@app.get("/profiles/{profile_id}/audio")
async def list_profile_audio(profile_id: int):
    with Session(engine) as session:
        outputs = session.query(AudioOutput).filter_by(profile_id=profile_id).all()
        return [{
            "id": a.id,
            "voice": a.voice,
            "created_at": a.created_at,
            "file_path": a.file_path
        } for a in outputs]

@app.get("/")
async def read_root():
    return {"status": "ok", "message": "Warrior Slug Lord of the Drug always busy fighting a fearsome Beetle riding a mighty Bug"}

@app.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
    try:
        content = await file.read()
        file_ext = file.filename.lower().split('.')[-1]
        
        try:
            text, pages = parse_document(content, file_ext)
            return JSONResponse(
                content={"text": text, "pages": pages}
            )
        except Exception as e:
            return JSONResponse(
                status_code=400,
                content={"error": str(e)}
            )
            
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"File processing error: {str(e)}"}
        )

@app.post("/generate")
async def generate_audio(request: TTSRequest):
    try:
        # Validate voice selection
        if not request.voice or len(request.voice) < 2:
            raise HTTPException(status_code=400, detail="Voice parameter must be provided in format: [a/b]_[name]")
            
        voice_type = request.voice[0].lower()
        if voice_type not in pipelines:
            raise HTTPException(status_code=400, detail=f"Invalid voice type: {voice_type}. Must be 'a' or 'b'")
            
        # Get pipeline for voice
        pipeline = pipelines[voice_type]
        
        # Generate text chunks
        chunks = chunk_text(request.text)
        
        # Validate chunk_id
        if not 0 <= request.chunk_id < len(chunks):
            raise HTTPException(status_code=400, detail="Invalid chunk ID")
            
        # Generate audio for specific chunk
        chunk = chunks[request.chunk_id]
        
        # Add debug logging
        print(f"Generating audio for chunk {request.chunk_id}, text length: {len(chunk)}")
        
        all_audio = []
        try:
            for _, _, audio in pipeline(chunk, voice=request.voice, speed=request.speed):
                all_audio.append(audio)
                print(f"Generated audio chunk, shape: {audio.shape}, dtype: {audio.dtype}")
        
        except Exception as e:
            print(f"Pipeline error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Audio generation failed: {str(e)}")
            
        # Process audio
        try:
            final_audio = numpy.concatenate(all_audio)
            audio_normalized = normalize_audio(final_audio)
            audio_int16 = (audio_normalized * 32767).astype(numpy.int16)
            
            # Create audio buffer
            buffer = io.BytesIO()
            sf.write(buffer, audio_int16, 24000, format='WAV', subtype='PCM_16')
            buffer.seek(0)
            
            # Create response with headers
            headers = {
                "X-Total-Chunks": str(len(chunks)),
                "X-Current-Chunk": str(request.chunk_id),
                "Content-Type": "audio/wav",
                "Cache-Control": "public, max-age=31536000",
                "Accept-Ranges": "bytes"
            }
            
            return StreamingResponse(
                buffer,
                media_type="audio/wav",
                headers=headers
            )
        except Exception as e:
            print(f"Audio processing error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Audio processing failed: {str(e)}")
            
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail}
    )

@app.delete("/profiles/{profile_id}/files/{file_id}")
async def delete_profile_file(profile_id: int, file_id: int):
    with Session(engine) as session:
        # Verify profile exists
        profile = session.query(Profile).filter_by(id=profile_id).first()
        if not profile:
            raise HTTPException(404, "Profile not found")
            
        # Find and delete file
        file = session.query(DBFile).filter_by(id=file_id, profile_id=profile_id).first()
        if not file:
            raise HTTPException(404, "File not found")
            
        session.delete(file)
        session.commit()
        
        return {"message": "File deleted successfully"}

@app.get("/profiles/{profile_id}/files/{file_id}")
async def get_profile_file(profile_id: int, file_id: int):
    with Session(engine) as session:
        # Verify profile exists
        profile = session.query(Profile).filter_by(id=profile_id).first()
        if not profile:
            raise HTTPException(404, "Profile not found")
            
        # Find file
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

@app.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: int):
    with Session(engine) as session:
        # Verify profile exists
        profile = session.query(Profile).filter_by(id=profile_id).first()
        if not profile:
            raise HTTPException(404, "Profile not found")
            
        # Delete profile (this will cascade delete all files due to relationship setup)
        session.delete(profile)
        session.commit()
        
        return {"message": "Profile deleted successfully"}

@app.delete("/profiles/{profile_id}/files")
async def delete_all_profile_files(profile_id: int):
    with Session(engine) as session:
        # Verify profile exists
        profile = session.query(Profile).filter_by(id=profile_id).first()
        if not profile:
            raise HTTPException(404, "Profile not found")
            
        # Delete all files for this profile
        session.query(DBFile).filter_by(profile_id=profile_id).delete()
        session.commit()
        
        return {"message": "All files deleted successfully"}
