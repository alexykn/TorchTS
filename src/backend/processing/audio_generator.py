import numpy
import pygame
from rich import print as rprint
import time
from queue import Queue
import logging
from typing import Optional, List, Iterator, Tuple

# Import Numba and math for the numerical optimizations.
import numba
import math

# -------------------------------
# Numba-optimized utility functions
# -------------------------------

@numba.njit
def normalize_audio_numba(audio_data, eps=1e-8):
    max_val = numpy.abs(audio_data).max()
    if max_val > eps:
        return audio_data / max_val
    return audio_data

def normalize_audio(audio_data: numpy.ndarray, eps: float = 1e-8) -> numpy.ndarray:
    """
    Wrapper that uses the Numba-accelerated version.
    """
    return normalize_audio_numba(audio_data, eps)


@numba.njit
def hann_window(M):
    """
    Compute a Hann window of length M.
    """
    window = numpy.empty(M, dtype=numpy.float64)
    for i in range(M):
        window[i] = 0.5 - 0.5 * math.cos(2 * math.pi * i / (M - 1))
    return window


@numba.njit
def crossfade_numba(audio1, audio2, fade_duration=0.1, sample_rate=24000):
    fade_length = int(fade_duration * sample_rate)
    n_audio1 = audio1.shape[0]
    n_audio2 = audio2.shape[0]
    if n_audio1 < fade_length or n_audio2 < fade_length:
        return numpy.concatenate((audio1, audio2))
    audio1_copy = audio1.copy()
    audio2_copy = audio2.copy()
    
    window = hann_window(2 * fade_length)
    fade_out = window[:fade_length]
    fade_in = window[fade_length:]
    
    # Apply crossfade via element-wise multiplication in a loop.
    for i in range(fade_length):
        audio1_copy[n_audio1 - fade_length + i] *= fade_out[i]
        audio2_copy[i] *= fade_in[i]
        
    # Compute the overlapped region with a loop.
    overlapped = numpy.empty(fade_length, dtype=audio1.dtype)
    for i in range(fade_length):
        overlapped[i] = audio1_copy[n_audio1 - fade_length + i] + audio2_copy[i]
        
    part1 = audio1_copy[:n_audio1 - fade_length]
    part3 = audio2_copy[fade_length:]
    result = numpy.concatenate((part1, overlapped, part3))
    
    # Manually clip the values to the range [-1.0, 1.0].
    for i in range(result.shape[0]):
        if result[i] < -1.0:
            result[i] = -1.0
        elif result[i] > 1.0:
            result[i] = 1.0
    return result

def crossfade(audio1: numpy.ndarray, audio2: numpy.ndarray, 
              fade_duration: float = 0.1, sample_rate: int = 24000) -> numpy.ndarray:
    """
    Wrapper that uses the Numba-accelerated crossfade.
    """
    return crossfade_numba(audio1, audio2, fade_duration, sample_rate)

# -------------------------------
# Pygame audio playback (unchanged in API)
# -------------------------------

def play_audio(audio_data: numpy.ndarray, sample_rate: int = 24000) -> None:
    """
    Play audio data through pygame mixer.
    
    Args:
        audio_data: Audio data to play
        sample_rate: Audio sample rate in Hz
    """
    try:
        # Normalize and convert to int16 with simple dithering.
        audio_normalized = normalize_audio(audio_data)
        dither = numpy.random.random(len(audio_normalized)) * 2e-5 - 1e-5
        audio_int16 = ((audio_normalized + dither) * 32767).astype(numpy.int16)
        
        sound = pygame.sndarray.make_sound(audio_int16)
        sound.set_volume(0.7)
        sound.play()
        
        while pygame.mixer.get_busy():
            time.sleep(0.1)
            
    except pygame.error as e:
        logging.error(f"Pygame audio playback error: {str(e)}")
    except Exception as e:
        logging.error(f"Unexpected audio playback error: {str(e)}")

# -------------------------------
# AudioGenerator Class (unchanged in API)
# -------------------------------

class AudioGenerator:
    def __init__(self, voice_name: str, pipeline):
        """
        Initialize AudioGenerator with voice and pipeline settings.
        
        Args:
            voice_name: Name of the voice to use.
            pipeline: TTS pipeline function.
        """
        self.voice_name = voice_name
        self.queue: Queue = Queue()
        self.is_running: bool = True
        self.pipeline = pipeline
        
        if not pygame.mixer.get_init():
            pygame.mixer.init(frequency=24000, size=-16, channels=1, buffer=4096)
        
    def __del__(self):
        if pygame.mixer.get_init():
            pygame.mixer.quit()

    def generate_chunks(self, chunks):
        """
        Generate the audio for all text chunks and put them in the queue.
        """
        for i, chunk in enumerate(chunks, 1):
            try:
                rprint(f"[yellow]Generating chunk {i}/{len(chunks)}...[/yellow]")
                # Generate audio via the pipeline.
                for _, _, audio in self.pipeline(chunk, voice=self.voice_name, speed=1):
                    self.queue.put(audio)
            except Exception as e:
                rprint(f"[red]Error generating chunk {i}:[/red] {str(e)}")
                continue
        self.queue.put(None)

    def play_chunks(self):
        """
        Play audio chunks as they become available, with crossfading between them.
        """
        prev_audio = None
        
        try:
            while self.is_running:
                audio = self.queue.get()
                if audio is None:
                    break
                
                if prev_audio is not None:
                    combined_audio = crossfade(prev_audio, audio)
                    play_audio(combined_audio)
                else:
                    play_audio(audio)
                
                prev_audio = audio
                self.queue.task_done()
        except Exception as e:
            logging.error(f"Error in audio playback loop: {str(e)}")