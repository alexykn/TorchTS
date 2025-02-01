import numpy
import pygame
from rich import print as rprint
import time
from queue import Queue

def normalize_audio(audio_data):
    """Normalize audio to prevent distortion"""
    max_val = numpy.abs(audio_data).max()
    if max_val > 0:
        return audio_data / max_val
    return audio_data

def crossfade(audio1, audio2, fade_duration=0.1, sample_rate=24000):
    """Create a crossfade between two audio segments"""
    fade_length = int(fade_duration * sample_rate)
    if len(audio1) < fade_length or len(audio2) < fade_length:
        return numpy.concatenate([audio1, audio2])
    
    # Create fade curves
    fade_out = numpy.linspace(1.0, 0.0, fade_length)
    fade_in = numpy.linspace(0.0, 1.0, fade_length)
    
    # Apply crossfade
    audio1[-fade_length:] *= fade_out
    audio2[:fade_length] *= fade_in
    
    # Overlap-add the crossfaded region
    result = numpy.concatenate([audio1[:-fade_length], 
                              audio1[-fade_length:] + audio2[:fade_length],
                              audio2[fade_length:]])
    return result

def play_audio(audio_data, sample_rate=24000):
    try:
        # Initialize pygame mixer if not initialized
        if not pygame.mixer.get_init():
            pygame.mixer.init(frequency=sample_rate, size=-16, channels=1, buffer=4096)
        
        # Normalize and convert to int16
        audio_normalized = normalize_audio(audio_data)
        audio_int16 = (audio_normalized * 32767).astype(numpy.int16)
        
        # Create and play sound
        sound = pygame.sndarray.make_sound(audio_int16)
        sound.set_volume(0.7)  # Reduce volume to 70%
        sound.play()
        
        while pygame.mixer.get_busy():
            time.sleep(0.1)
            
    except Exception as e:
        rprint(f"[red]Audio playback error:[/red] {str(e)}")
    finally:
        pygame.mixer.quit()

class AudioGenerator:
    def __init__(self, voice_name, pipeline):
        self.voice_name = voice_name
        self.queue = Queue()
        self.is_running = True
        self.pipeline = pipeline
        
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
        pygame.mixer.init(frequency=24000, size=-16, channels=1, buffer=4096)
        
        try:
            while self.is_running:
                audio = self.queue.get()
                if audio is None:
                    break
                
                if prev_audio is not None:
                    # Apply crossfade between chunks
                    combined_audio = crossfade(prev_audio, audio)
                    play_audio(combined_audio)
                else:
                    play_audio(audio)
                
                prev_audio = audio
                self.queue.task_done()
        finally:
            pygame.mixer.quit()