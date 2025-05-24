from fastapi import FastAPI, HTTPException, Request, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Import service functions
from services.profile_service import create_profile_service, list_profiles_service, delete_profile_service
from services.file_service import (
    list_profile_files_service,
    upload_profile_file_service,
    get_profile_file_service,
    delete_profile_file_service,
    delete_all_profile_files_service,
    upload_file_service
)
from services.tts_service import (
    generate_single_tts,
    generate_multi_tts,
    stop_generation_service,
    list_profile_audio_service
)

app = FastAPI(
    title="TorchTS API",
    description="Text-to-Speech API using TorchTS",
    version="1.0.0"
)

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://localhost:5174", 
        "http://localhost:5005", "http://0.0.0.0:5005",
        "https://frontend.torchts.orb.local", "https://backend.torchts.orb.local"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Chunks", "X-Current-Chunk", "Content-Type", "Content-Length", "X-Session-ID"]
)

# Pydantic models for request validation
class TTSRequest(BaseModel):
    text: str
    voice: str
    chunk_id: Optional[int] = 0
    speed: Optional[float] = 1.0

class ProfileCreate(BaseModel):
    name: str
    voice_preset: Optional[str] = None
    volume: float = 0.8

class StopGenerationRequest(BaseModel):
    session_id: str

class MultiTTSRequest(BaseModel):
    text: str
    speed: Optional[float] = 1.0
    speakers: dict[str, str]

@app.post("/profiles")
async def create_profile(profile: ProfileCreate):
    return await create_profile_service(profile)

@app.get("/profiles")
async def list_profiles():
    return await list_profiles_service()

@app.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: int):
    return await delete_profile_service(profile_id)

@app.get("/profiles/{profile_id}/files")
async def list_profile_files(profile_id: int):
    return await list_profile_files_service(profile_id)

@app.post("/profiles/{profile_id}/files")
async def upload_profile_file(profile_id: int, file: UploadFile = File(...)):
    return await upload_profile_file_service(profile_id, file)

@app.get("/profiles/{profile_id}/files/{file_id}")
async def get_profile_file(profile_id: int, file_id: int):
    return await get_profile_file_service(profile_id, file_id)

@app.delete("/profiles/{profile_id}/files/{file_id}")
async def delete_profile_file(profile_id: int, file_id: int):
    return await delete_profile_file_service(profile_id, file_id)

@app.delete("/profiles/{profile_id}/files")
async def delete_all_profile_files(profile_id: int):
    return await delete_all_profile_files_service(profile_id)

@app.get("/profiles/{profile_id}/audio")
async def list_profile_audio(profile_id: int):
    return await list_profile_audio_service(profile_id)

@app.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
    return await upload_file_service(file)

@app.post("/generate")
async def generate_audio(request: TTSRequest):
    return generate_single_tts(request)

@app.post("/generate_multi")
async def generate_audio_multi(request: MultiTTSRequest):
    return generate_multi_tts(request)

@app.post("/stop-generation")
async def stop_generation(request: StopGenerationRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(stop_generation_service, request.session_id)
    return {"message": "Generation cancellation initiated", "session_id": request.session_id}

@app.get("/")
async def read_root():
    return {"status": "ok", "message": "Warrior Slug Lord of the Drug always busy fighting a fearsome Beetle riding a mighty Bug"}

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
