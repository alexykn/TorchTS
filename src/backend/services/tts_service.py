import hashlib
import io
import numpy
import soundfile as sf
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from processing.text_processor import chunk_text
from processing.audio_generator import normalize_audio
import asyncio
from services.model_service import get_model_manager
from threading import Lock

# Global variable to track active generation sessions
# Access to this set must be synchronized because FastAPI can handle
# multiple requests concurrently using threads. A simple lock is
# sufficient since operations on the set are short lived.
active_generations = set()
# Lock protecting modifications to ``active_generations``
active_generations_lock = Lock()

def generate_single_tts(request):
    session_data = f"{request.voice}_{request.text[:32]}".encode('utf-8')
    session_id = hashlib.md5(session_data).hexdigest()
    
    try:
        # Register this session as active. Operations on ``active_generations``
        # are protected by ``active_generations_lock`` to avoid race conditions
        # when multiple requests modify the set concurrently.
        with active_generations_lock:
            if session_id in active_generations:
                if request.chunk_id == 0:
                    active_generations.remove(session_id)
                    active_generations.add(session_id)
            else:
                active_generations.add(session_id)
        
        if not request.voice or len(request.voice) < 2:
            raise HTTPException(status_code=400, detail="Voice parameter must be provided in format: [a/b]_[name]")
        
        voice_type = request.voice[0].lower()
        model_manager = get_model_manager()
        chunks = chunk_text(request.text)
        
        if not 0 <= request.chunk_id < len(chunks):
            raise HTTPException(status_code=400, detail="Invalid chunk ID")
            
        chunk = chunks[request.chunk_id]
        
        all_audio = []
        with model_manager.get_pipeline(voice_type) as pipeline:
            for _, _, audio in pipeline(chunk, voice=request.voice, speed=request.speed):
                if session_id not in active_generations:
                    raise HTTPException(status_code=499, detail="Client cancelled request")
                all_audio.append(audio)
        
        final_audio = numpy.concatenate(all_audio)
        audio_normalized = normalize_audio(final_audio)
        audio_int16 = (audio_normalized * 32767).astype(numpy.int16)
        
        buffer = io.BytesIO()
        sf.write(buffer, audio_int16, 24000, format='WAV', subtype='PCM_16')
        buffer.seek(0)
        
        headers = {
            "X-Total-Chunks": str(len(chunks)),
            "X-Current-Chunk": str(request.chunk_id),
            "Content-Type": "audio/wav",
            "Cache-Control": "public, max-age=31536000",
            "Accept-Ranges": "bytes",
            "X-Session-ID": session_id
        }
        
        return StreamingResponse(buffer, media_type="audio/wav", headers=headers)
    except HTTPException as he:
        with active_generations_lock:
            active_generations.discard(session_id)
        raise he
    except Exception as e:
        with active_generations_lock:
            active_generations.discard(session_id)
        raise HTTPException(status_code=500, detail=str(e))

def generate_multi_tts(request):
    session_data = ("multi_" + request.text[:32]).encode('utf-8')
    session_id = hashlib.md5(session_data).hexdigest()
    
    # Ensure only one thread modifies the active session tracker at a time.
    with active_generations_lock:
        if session_id in active_generations:
            active_generations.remove(session_id)
        active_generations.add(session_id)
    
    def parse_segments(text: str):
        segments = []
        cleaned_text = text.replace("<<<", "")
        parts = cleaned_text.split(">>>")
        for part in parts:
            part = part.strip()
            if not part:
                continue
            tokens = part.split(maxsplit=1)
            speaker = tokens[0]
            segment_text = tokens[1] if len(tokens) > 1 else ""
            segments.append((speaker, segment_text.strip()))
        return segments
    
    try:
        segments = parse_segments(request.text)
        if not segments:
            raise HTTPException(status_code=400, detail="No valid segments found in text")
        
        all_audio_segments = []
        for idx, (speaker_id, segment_text) in enumerate(segments):
            if not segment_text:
                continue
            voice = request.speakers.get(speaker_id, None)
            if not voice or len(voice) < 2:
                raise HTTPException(status_code=400, detail=f"Voice for speaker {speaker_id} is invalid or not provided")
            voice_type = voice[0].lower()
            model_manager = get_model_manager()
            chunks = chunk_text(segment_text)
            if not chunks:
                continue
            segment_audio_chunks = []
            with model_manager.get_pipeline(voice_type) as pipeline:
                for chunk in chunks:
                    if session_id not in active_generations:
                        raise HTTPException(status_code=499, detail="Client cancelled request")
                    for _, _, audio in pipeline(chunk, voice=voice, speed=request.speed):
                        if session_id not in active_generations:
                            raise HTTPException(status_code=499, detail="Client cancelled request")
                        segment_audio_chunks.append(audio)
            if segment_audio_chunks:
                final_segment_audio = numpy.concatenate(segment_audio_chunks)
                all_audio_segments.append(final_segment_audio)
                
        if not all_audio_segments:
            raise HTTPException(status_code=400, detail="No audio generated for any segment")
        
        final_audio = numpy.concatenate(all_audio_segments)
        audio_normalized = normalize_audio(final_audio)
        audio_int16 = (audio_normalized * 32767).astype(numpy.int16)
        
        buffer = io.BytesIO()
        sf.write(buffer, audio_int16, 24000, format='WAV', subtype='PCM_16')
        buffer.seek(0)
        
        with active_generations_lock:
            active_generations.discard(session_id)
        
        headers = {
            "Content-Type": "audio/wav",
            "Cache-Control": "public, max-age=31536000",
            "Accept-Ranges": "bytes",
            "X-Session-ID": session_id,
            "X-Mode": "multi",
            "X-Segment-Count": str(len(segments))
        }
        return StreamingResponse(buffer, media_type="audio/wav", headers=headers)
    except HTTPException as he:
        with active_generations_lock:
            active_generations.discard(session_id)
        raise he
    except Exception as e:
        with active_generations_lock:
            active_generations.discard(session_id)
        raise HTTPException(status_code=500, detail=f"Multi-speaker audio generation failed: {str(e)}")

def stop_generation_service(session_id: str):
    # Modification of ``active_generations`` can occur concurrently with
    # generation requests, so protect it with the lock here as well.
    with active_generations_lock:
        if session_id in active_generations:
            active_generations.discard(session_id)
            return {"message": "Generation stopped successfully", "session_id": session_id}
        else:
            return {"message": "No active generation found for this session", "session_id": session_id}

async def list_profile_audio_service(profile_id: int):
    """List audio outputs for a profile. Returns empty list if SQLAlchemy is not available."""
    try:
        from storage.models import (
            ASYNC_DB,
            AsyncSessionLocal,
            engine,
            AudioOutput,
            SA_AVAILABLE,
        )
        from sqlalchemy import select  # type: ignore
        from sqlalchemy.orm import Session  # type: ignore
        
        if not SA_AVAILABLE or engine is None:
            return []

        if ASYNC_DB and AsyncSessionLocal and AudioOutput:
            async with AsyncSessionLocal() as session:  # type: ignore
                result = await session.execute(  # type: ignore
                    select(AudioOutput).where(AudioOutput.profile_id == profile_id)  # type: ignore
                )
                outputs = result.scalars().all()  # type: ignore
                return [
                    {
                        "id": a.id,
                        "voice": a.voice,
                        "created_at": a.created_at,
                        "file_path": a.file_path,
                    }
                    for a in outputs
                ]
        else:
            def _sync_op():
                with Session(engine) as session:  # type: ignore
                    outputs = session.query(AudioOutput).filter_by(profile_id=profile_id).all()  # type: ignore
                    return [
                        {
                            "id": a.id,
                            "voice": a.voice,
                            "created_at": a.created_at,
                            "file_path": a.file_path,
                        }
                        for a in outputs
                    ]

            return await asyncio.to_thread(_sync_op)
    except Exception:
        # Return empty list if SQLAlchemy or database operations fail
        return []
