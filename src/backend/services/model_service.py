import asyncio
import threading
import time
import os
from typing import Optional, Dict, Any
from contextlib import contextmanager
import torch
import gc
from kokoro import KPipeline, KModel
from rich.console import Console
from rich import print as rprint

console = Console()

class ModelManager:
    """
    Manages the lifecycle of the Kokoro TTS model and pipelines.
    Automatically unloads the model after a period of inactivity to save memory,
    and reloads it on-demand when needed.
    """
    
    def __init__(self, 
                 unload_timeout: int = 300,  # 5 minutes default
                 device: Optional[str] = None):
        """
        Initialize the ModelManager.
        
        Args:
            unload_timeout: Seconds of inactivity before unloading model (default: 300s)
            device: Device to load model on ('cuda', 'cpu', or None for auto)
        """
        self.unload_timeout = unload_timeout
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Model and pipeline storage
        self._model: Optional[KModel] = None
        self._pipelines: Dict[str, KPipeline] = {}
        
        # Thread safety
        self._lock = threading.RLock()
        self._loading_event = threading.Event()
        self._is_loading = False
        
        # Activity tracking
        self._last_activity = time.time()
        self._unload_task: Optional[asyncio.Task] = None
        self._shutdown = False
        
        # Start the background unload scheduler
        self._start_unload_scheduler()
        
        rprint(f"[green]ModelManager initialized with {unload_timeout}s timeout on {self.device}[/green]")
    
    def _start_unload_scheduler(self):
        """Start the background task that schedules model unloading."""
        # Don't start scheduler during initialization - start it when model is first used
        pass
    
    def _ensure_unload_scheduler_running(self):
        """Ensure the unload scheduler is running. Called when model is first used."""
        if self._unload_task is not None:
            return  # Already running
            
        try:
            loop = asyncio.get_running_loop()
            self._unload_task = loop.create_task(self._unload_scheduler())
            rprint("[blue]Started model unload scheduler[/blue]")
        except RuntimeError:
            rprint("[yellow]Warning: Could not start unload scheduler (no async context)[/yellow]")
    
    async def _unload_scheduler(self):
        """Background task that unloads the model after timeout."""
        while not self._shutdown:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                
                if self._model is not None:
                    time_since_activity = time.time() - self._last_activity
                    if time_since_activity >= self.unload_timeout:
                        with self._lock:
                            if self._model is not None:  # Double-check after acquiring lock
                                rprint("[yellow]Unloading model due to inactivity[/yellow]")
                                self._unload_model_internal()
                                
            except asyncio.CancelledError:
                break
            except Exception as e:
                rprint(f"[red]Error in unload scheduler: {e}[/red]")
                await asyncio.sleep(60)  # Wait longer on error
    
    def _load_model_internal(self):
        """Internal method to load the model and pipelines. Must be called with lock held."""
        if self._model is not None:
            return  # Already loaded
        
        rprint(f"[yellow]Loading Kokoro model on {self.device}...[/yellow]")
        start_time = time.time()
        
        try:
            # Load the model
            self._model = KModel().to(self.device).eval()
            
            # Initialize pipelines for all supported languages
            self._pipelines = {
                'a': KPipeline(lang_code='a', model=self._model),  # American English
                'b': KPipeline(lang_code='b', model=self._model),  # British English
                'e': KPipeline(lang_code='e', model=self._model),  # Spanish
                'f': KPipeline(lang_code='f', model=self._model),  # French
                'h': KPipeline(lang_code='h', model=self._model),  # Hindi
                'i': KPipeline(lang_code='i', model=self._model),  # Italian
                'j': KPipeline(lang_code='j', model=self._model),  # Japanese
                'p': KPipeline(lang_code='p', model=self._model),  # Brazilian Portuguese
                'z': KPipeline(lang_code='z', model=self._model)   # Mandarin Chinese
            }
            
            load_time = time.time() - start_time
            rprint(f"[green]Model loaded successfully in {load_time:.2f}s[/green]")
            
        except Exception as e:
            rprint(f"[red]Failed to load model: {e}[/red]")
            self._model = None
            self._pipelines = {}
            raise
    
    def _unload_model_internal(self):
        """Internal method to unload the model and free memory. Must be called with lock held."""
        if self._model is None:
            return  # Already unloaded
        
        rprint("[yellow]Unloading model and freeing memory...[/yellow]")
        
        try:
            # Clear pipelines
            self._pipelines.clear()
            
            # Delete model
            del self._model
            self._model = None
            
            # Force garbage collection and CUDA cache clearing
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
            
            rprint("[green]Model unloaded successfully[/green]")
            
        except Exception as e:
            rprint(f"[red]Error during model unloading: {e}[/red]")
    
    @contextmanager
    def get_pipeline(self, lang_code: str):
        """
        Context manager to get a pipeline for the specified language.
        Automatically loads the model if needed and updates activity timestamp.
        
        Args:
            lang_code: Language code ('a', 'b', 'e', 'f', 'h', 'i', 'j', 'p', 'z')
            
        Yields:
            KPipeline: The pipeline for the specified language
            
        Raises:
            ValueError: If lang_code is not supported
            RuntimeError: If model loading fails
        """
        if lang_code not in ['a', 'b', 'e', 'f', 'h', 'i', 'j', 'p', 'z']:
            raise ValueError(f"Unsupported language code: {lang_code}")
        
        # Update activity timestamp
        self._last_activity = time.time()
        
        with self._lock:
            # If model is not loaded, load it
            if self._model is None:
                if self._is_loading:
                    # Another thread is loading, wait for it
                    self._loading_event.wait(timeout=60)  # Wait up to 60 seconds
                    if self._model is None:
                        raise RuntimeError("Model loading failed or timed out")
                else:
                    # We need to load the model
                    self._is_loading = True
                    self._loading_event.clear()
                    try:
                        self._load_model_internal()
                        # Start unload scheduler after successful model load
                        self._ensure_unload_scheduler_running()
                    finally:
                        self._is_loading = False
                        self._loading_event.set()
            
            # Return the pipeline
            if lang_code not in self._pipelines:
                raise RuntimeError(f"Pipeline for language {lang_code} not available")
            
            pipeline = self._pipelines[lang_code]
        
        try:
            yield pipeline
        finally:
            # Update activity timestamp again after use
            self._last_activity = time.time()
    
    def force_unload(self):
        """Force immediate unloading of the model."""
        with self._lock:
            if self._model is not None:
                rprint("[yellow]Force unloading model...[/yellow]")
                self._unload_model_internal()
    
    def get_model_status(self) -> Dict[str, Any]:
        """
        Get current status of the model manager.
        
        Returns:
            Dict containing model status information
        """
        with self._lock:
            is_loaded = self._model is not None
            time_since_activity = time.time() - self._last_activity if is_loaded else None
            
            status = {
                "model_loaded": is_loaded,
                "device": self.device,
                "unload_timeout": self.unload_timeout,
                "time_since_last_activity": time_since_activity,
                "is_loading": self._is_loading,
                "available_languages": list(self._pipelines.keys()) if is_loaded else []
            }
            
            if torch.cuda.is_available():
                status["gpu_memory_allocated"] = torch.cuda.memory_allocated()
                status["gpu_memory_reserved"] = torch.cuda.memory_reserved()
            
            return status
    
    def update_timeout(self, new_timeout: int):
        """Update the unload timeout."""
        if new_timeout < 60:
            raise ValueError("Timeout must be at least 60 seconds")
        
        with self._lock:
            self.unload_timeout = new_timeout
            rprint(f"[blue]Updated unload timeout to {new_timeout}s[/blue]")
    
    def shutdown(self):
        """Shutdown the model manager and clean up resources."""
        self._shutdown = True
        
        if self._unload_task:
            self._unload_task.cancel()
        
        with self._lock:
            self._unload_model_internal()
        
        rprint("[green]ModelManager shut down[/green]")

# Global instance
_model_manager: Optional[ModelManager] = None

def get_model_manager() -> ModelManager:
    """Get the global ModelManager instance."""
    global _model_manager
    if _model_manager is None:
        # Read configuration from environment
        timeout = int(os.getenv("MODEL_UNLOAD_TIMEOUT", "300"))  # 5 minutes default
        device = os.getenv("MODEL_DEVICE", None)
        
        _model_manager = ModelManager(unload_timeout=timeout, device=device)
        
        # Scheduler will start when model is first used
    
    return _model_manager

def shutdown_model_manager():
    """Shutdown the global model manager."""
    global _model_manager
    if _model_manager:
        _model_manager.shutdown()
        _model_manager = None