import warnings
import signal
import sys
import torch
from rich.console import Console
from rich import print as rprint
from rich import traceback #Noqa
import uvicorn
from services.model_service import get_model_manager, shutdown_model_manager

warnings.filterwarnings("ignore", category=FutureWarning, module="torch.nn.utils.weight_norm")
warnings.filterwarnings("ignore", category=UserWarning, module="torch.nn.modules.rnn")

console = Console()

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    rprint("[yellow]Received shutdown signal, cleaning up...[/yellow]")
    shutdown_model_manager()
    sys.exit(0)

if __name__ == "__main__":
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        from api.api import app
        
        # Initialize the model manager (but don't load the model yet)
        model_manager = get_model_manager()
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        rprint(f"[green]INFO:     Using device: {device}[/green]")
        rprint(f"[blue]INFO:     Model will be loaded on-demand (timeout: {model_manager.unload_timeout}s)[/blue]")

        # Start the FastAPI server
        rprint("[green]INFO:     Server starting...[/green]")
        uvicorn.run(app, host="0.0.0.0", port=5005)
    except KeyboardInterrupt:
        rprint("[red]Program terminated by user[/red]")
        shutdown_model_manager()
    except Exception as e:
        rprint(f"[red]Error starting server: {e}[/red]")
        shutdown_model_manager()

