import numpy
import pygame
from rich import print as rprint
import time
from queue import Queue
import logging
from typing import Optional, List, Iterator, Tuple

def normalize_audio(audio_data: numpy.ndarray, eps: float = 1e-8) -> numpy.ndarray:
    """
    Normalize audio data to prevent distortion.
    
    Args:
        audio_data: Input audio array
        eps: Small epsilon value to prevent division by zero
        
    Returns:
        Normalized audio array with values between -1 and 1
    """
    max_val = numpy.abs(audio_data).max()
    if max_val > eps:
        return audio_data / max_val
    return audio_data

def crossfade(audio1: numpy.ndarray, audio2: numpy.ndarray, 
             fade_duration: float = 0.1, sample_rate: int = 24000) -> numpy.ndarray:
    """
    Create a smooth crossfade between two audio segments using a Hann window.
    
    Args:
        audio1: First audio segment
        audio2: Second audio segment
        fade_duration: Duration of crossfade in seconds
        sample_rate: Audio sample rate in Hz
        
    Returns:
        Combined audio with smooth crossfade
    """
    fade_length = int(fade_duration * sample_rate)
    if len(audio1) < fade_length or len(audio2) < fade_length:
        return numpy.concatenate([audio1, audio2])
    
    # Create copies to avoid modifying original arrays
    audio1_copy = audio1.copy()
    audio2_copy = audio2.copy()
    
    # Create Hann window for smoother crossfade
    window = numpy.hanning(2 * fade_length)
    fade_out = window[:fade_length]
    fade_in = window[fade_length:]
    
    # Apply crossfade
    audio1_copy[-fade_length:] *= fade_out
    audio2_copy[:fade_length] *= fade_in
    
    # Overlap-add and clip to prevent distortion
    result = numpy.concatenate([
        audio1_copy[:-fade_length],
        audio1_copy[-fade_length:] + audio2_copy[:fade_length],
        audio2_copy[fade_length:]
    ])
    
    return numpy.clip(result, -1.0, 1.0)

def play_audio(audio_data: numpy.ndarray, sample_rate: int = 24000) -> None:
    """
    Play audio data through pygame mixer.
    
    Args:
        audio_data: Audio data to play
        sample_rate: Audio sample rate in Hz
    """
    try:
        # Normalize and convert to int16 with dithering
        audio_normalized = normalize_audio(audio_data)
        # Add small amount of noise before quantization (simple dithering)
        dither = numpy.random.random(len(audio_normalized)) * 2e-5 - 1e-5
        audio_int16 = ((audio_normalized + dither) * 32767).astype(numpy.int16)
        
        # Create and play sound
        sound = pygame.sndarray.make_sound(audio_int16)
        sound.set_volume(0.7)
        sound.play()
        
        while pygame.mixer.get_busy():
            time.sleep(0.1)
            
    except pygame.error as e:
        logging.error(f"Pygame audio playback error: {str(e)}")
    except Exception as e:
        logging.error(f"Unexpected audio playback error: {str(e)}")

class AudioGenerator:
    def __init__(self, voice_name: str, pipeline):
        """
        Initialize AudioGenerator with voice and pipeline settings.
        
        Args:
            voice_name: Name of the voice to use
            pipeline: TTS pipeline function
        """
        self.voice_name = voice_name
        self.queue: Queue = Queue()
        self.is_running: bool = True
        self.pipeline = pipeline
        
        # Initialize pygame mixer once
        if not pygame.mixer.get_init():
            pygame.mixer.init(frequency=24000, size=-16, channels=1, buffer=4096)
        
    def __del__(self):
        """Cleanup pygame mixer on deletion"""
        if pygame.mixer.get_init():
            pygame.mixer.quit()

    def generate_chunks(self, chunks):
        """Generate audio for all chunks and put in queue"""
        for i, chunk in enumerate(chunks, 1):
            try:
                rprint(f"[yellow]Generating chunk {i}/{len(chunks)}...[/yellow]")
                # Use the correct pipeline to generate audio
                for _, _, audio in self.pipeline(chunk, voice=self.voice_name, speed=1):
                    self.queue.put(audio)
            except Exception as e:
                rprint(f"[red]Error generating chunk {i}:[/red] {str(e)}")
                continue
        self.queue.put(None)  # Signal end of chunks

    def play_chunks(self):
        """Play audio chunks as they become available with crossfading"""
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