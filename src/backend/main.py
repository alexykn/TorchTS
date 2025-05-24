import warnings
from kokoro import KPipeline, KModel
from rich.console import Console
from rich import print as rprint
from rich import traceback #Noqa
import uvicorn
import torch
warnings.filterwarnings("ignore", category=FutureWarning, module="torch.nn.utils.weight_norm")
warnings.filterwarnings("ignore", category=UserWarning, module="torch.nn.modules.rnn")

console = Console()
device = 'cuda' if torch.cuda.is_available() else 'cpu'

model = KModel().to(device).eval()

# Initialize pipelines for all supported languages
pipelines = {
    'a': KPipeline(lang_code='a', model=model),  # American English
    'b': KPipeline(lang_code='b', model=model),  # British English
    'e': KPipeline(lang_code='e', model=model),  # Spanish
    'f': KPipeline(lang_code='f', model=model),  # French
    'h': KPipeline(lang_code='h', model=model),  # Hindi
    'i': KPipeline(lang_code='i', model=model),  # Italian
    'j': KPipeline(lang_code='j', model=model),  # Japanese
    'p': KPipeline(lang_code='p', model=model),  # Brazilian Portuguese
    'z': KPipeline(lang_code='z', model=model)   # Mandarin Chinese
}

if __name__ == "__main__":
    try:
        from api.api import app
        rprint(f"[green]INFO:     Using device: {model.device}[/green]")

        # Start the FastAPI server
        rprint("[green]INFO:     OK[/green]")
        uvicorn.run(app, host="0.0.0.0", port=5005)
    except KeyboardInterrupt:
        rprint("[red]Program terminated by user[/red]")
    except Exception as e:
        rprint(f"[red]Error starting server: {e}[/red]")

