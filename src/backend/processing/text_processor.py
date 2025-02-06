import re
import logging
from pathlib import Path
from rich import print as rprint
from typing import List, Optional

# Set up logging (adjust logging configuration as needed)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_TOKENS = 400

# Precompile regex patterns to improve performance
SENTENCE_DELIMITER_RE = re.compile(r'([.!?]+)')
PUNCTUATION_DELIMITER_RE = re.compile(r'([,;])')

def split_sentences(text: str) -> List[str]:
    """
    Split text into sentences while preserving the punctuation.
    
    Args:
        text (str): The input text.
    
    Returns:
        List[str]: A list of sentences.
    """
    parts = SENTENCE_DELIMITER_RE.split(text)
    # Combine text segments with their following punctuation
    sentences = [''.join(pair) for pair in zip(parts[0::2], parts[1::2] + [''])]
    return sentences

def chunk_text(text: str, max_tokens: int = MAX_TOKENS) -> List[str]:
    """
    Split text into chunks that do not exceed max_tokens characters.
    
    If a sentence exceeds max_tokens, further splits are performed at commas 
    or by word boundaries.
    
    Args:
        text (str): The text to be chunked.
        max_tokens (int): Maximum number of characters per chunk.
    
    Returns:
        List[str]: A list of text chunks.
    """
    sentences = split_sentences(text)
    chunks = []
    current_chunk = []
    current_token_count = 0

    for sentence in sentences:
        sentence_length = len(sentence)
        if sentence_length > max_tokens:
            # If a sentence is too long, split further at commas/semicolons.
            parts = PUNCTUATION_DELIMITER_RE.split(sentence)
            parts = [''.join(pair) for pair in zip(parts[0::2], parts[1::2] + [''])]
            for part in parts:
                if len(part) > max_tokens:
                    # For parts that are still too long, split on word boundaries.
                    words = part.split()
                    temp_chunk = []
                    temp_count = 0
                    for word in words:
                        word_length = len(word) + 1  # Account for the space.
                        if temp_count + word_length > max_tokens:
                            chunks.append(' '.join(temp_chunk))
                            temp_chunk = [word]
                            temp_count = word_length
                        else:
                            temp_chunk.append(word)
                            temp_count += word_length
                    if temp_chunk:
                        chunks.append(' '.join(temp_chunk))
                else:
                    if current_token_count + len(part) > max_tokens:
                        chunks.append(' '.join(current_chunk))
                        current_chunk = [part]
                        current_token_count = len(part)
                    else:
                        current_chunk.append(part)
                        current_token_count += len(part)
        else:
            if current_token_count + sentence_length > max_tokens:
                chunks.append(' '.join(current_chunk))
                current_chunk = [sentence]
                current_token_count = sentence_length
            else:
                current_chunk.append(sentence)
                current_token_count += sentence_length

    if current_chunk:
        chunks.append(' '.join(current_chunk))

    # Debug info: Print and log chunk details.
    rprint(f"[cyan]Split into {len(chunks)} chunks:[/cyan]")
    for i, chunk in enumerate(chunks, 1):
        debug_message = f"[dim]Chunk {i}: {len(chunk)} chars. Ends with: ...{chunk[-50:]}[/dim]"
        rprint(debug_message)
        logger.debug(debug_message)
    
    return chunks

def read_text_file(file_path: str) -> Optional[str]:
    """
    Read text from .txt or .md files.
    
    Args:
        file_path (str): Path to the text file.
    
    Returns:
        Optional[str]: The file's content, or None if an error occurs.
    """
    try:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        if path.suffix.lower() not in ['.txt', '.md']:
            raise ValueError("Only .txt and .md files are supported")
        with path.open('r', encoding='utf-8') as file:
            return file.read()
    except Exception as e:
        rprint(f"[red]Error reading file:[/red] {str(e)}")
        logger.error("Error reading file %s: %s", file_path, e)
        return None