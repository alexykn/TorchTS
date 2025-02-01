from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import numpy
import soundfile as sf
import io
from main import pipelines
from text_processor import chunk_text
from audio_generator import normalize_audio
from document_parser import parse_document

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