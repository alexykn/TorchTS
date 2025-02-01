import re
from pathlib import Path
from rich import print as rprint

MAX_TOKENS = 400

def chunk_text(text, max_tokens=MAX_TOKENS):
    """Split text into chunks at natural boundaries"""
    # Split at sentence endings (.!?) and preserve the punctuation
    sentences = re.split('([.!?]+)', text)
    # Recombine sentences with their punctuation
    sentences = [''.join(i) for i in zip(sentences[0::2], sentences[1::2] + [''])]
    
    chunks = []
    current_chunk = []
    current_token_count = 0
    
    for sentence in sentences:
        sentence_tokens = len(sentence)
        
        if sentence_tokens > max_tokens:
            # If single sentence is too long, split at commas
            parts = re.split('([,;])', sentence)
            parts = [''.join(i) for i in zip(parts[0::2], parts[1::2] + [''])]
            
            for part in parts:
                if len(part) > max_tokens:
                    # If still too long, split at spaces nearest to max_tokens
                    words = part.split()
                    temp_chunk = []
                    temp_count = 0
                    
                    for word in words:
                        word_tokens = len(word) + 1
                        if temp_count + word_tokens > max_tokens:
                            chunks.append(' '.join(temp_chunk))
                            temp_chunk = [word]
                            temp_count = word_tokens
                        else:
                            temp_chunk.append(word)
                            temp_count += word_tokens
                            
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
            if current_token_count + sentence_tokens > max_tokens:
                chunks.append(' '.join(current_chunk))
                current_chunk = [sentence]
                current_token_count = sentence_tokens
            else:
                current_chunk.append(sentence)
                current_token_count += sentence_tokens
    
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    # Debug info
    rprint(f"[cyan]Split into {len(chunks)} chunks:[/cyan]")
    for i, chunk in enumerate(chunks, 1):
        rprint(f"[dim]Chunk {i}: {len(chunk)} chars[/dim]")
        rprint(f"[dim]Ends with: ...{chunk[-50:]}[/dim]")
    
    return chunks

def read_text_file(file_path):
    """Read text from .txt or .md files"""
    try:
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
            
        if file_path.suffix.lower() not in ['.txt', '.md']:
            raise ValueError("Only .txt and .md files are supported")
            
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    except Exception as e:
        rprint(f"[red]Error reading file:[/red] {str(e)}")
        return None