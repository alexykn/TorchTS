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
from services.model_service import get_model_manager

app = FastAPI(
    title="TorchTS API",
    description="Text-to-Speech API using TorchTS",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    """Initialize model manager and start unload scheduler on startup."""
    model_manager = get_model_manager()
    model_manager._ensure_unload_scheduler_running()

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173", "http://127.0.0.1:5174",
        "http://localhost:5173", "http://0.0.0.0:5173",
        "http://localhost:5174", "http://0.0.0.0:5174",
        "http://localhost:5005", "http://0.0.0.0:5005",
        "https://frontend.torchts.orb.local", "https://backend.torchts.orb.local"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Chunks", "X-Current-Chunk", "Content-Type", "Content-Length", "X-Session-ID"]
)

# Generic handler for CORS preflight requests
@app.options("/{path:path}")
async def preflight_handler(path: str):
    """Handle CORS preflight checks for any endpoint."""
    return JSONResponse(status_code=200, content={})

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

class ModelTimeoutUpdate(BaseModel):
    timeout_seconds: int

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

@app.get("/model/status")
async def get_model_status():
    """Get current model status and memory usage."""
    model_manager = get_model_manager()
    return model_manager.get_model_status()

@app.post("/model/unload")
async def force_unload_model():
    """Force immediate unloading of the model to free memory."""
    model_manager = get_model_manager()
    model_manager.force_unload()
    return {"message": "Model unloaded successfully"}

@app.post("/model/timeout")
async def update_model_timeout(request: ModelTimeoutUpdate):
    """Update the model unload timeout."""
    model_manager = get_model_manager()
    try:
        model_manager.update_timeout(request.timeout_seconds)
        return {"message": f"Timeout updated to {request.timeout_seconds} seconds"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/")
async def read_root():
    return {"status": "ok", "message": "Warrior Slug Lord of the Drug always busy fighting a fearsome Beetle riding a mighty Bug"}

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
