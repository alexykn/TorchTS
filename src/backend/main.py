import warnings
from kokoro import KPipeline
from rich.console import Console
from rich import print as rprint
import uvicorn

warnings.filterwarnings("ignore", category=FutureWarning, module="torch.nn.utils.weight_norm")
warnings.filterwarnings("ignore", category=UserWarning, module="torch.nn.modules.rnn")

console = Console()
device = 'cpu'

# Initialize pipelines for both languages
pipelines = {
    'a': KPipeline(lang_code='a'),  # American English
    'b': KPipeline(lang_code='b')   # British English
}

if __name__ == "__main__":
    try:
        from api.api import app
        # Start the FastAPI server
        rprint("[green]INFO:     OK[/green]")
        uvicorn.run(app, host="0.0.0.0", port=5005)
    except KeyboardInterrupt:
        rprint("[red]Program terminated by user[/red]")
    except Exception as e:
        rprint(f"[red]Error starting server: {e}[/red]")

