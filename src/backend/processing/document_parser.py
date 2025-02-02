from docx import Document
from odf.opendocument import load
from odf.text import P
from pypdf import PdfReader
import io
from typing import Tuple

def parse_pdf(content: bytes) -> Tuple[str, int]:
    """
    Extract text from a PDF file content.
    
    Args:
        content: The bytes content of the PDF file
        
    Returns:
        Tuple[str, int]: Extracted text content and number of pages
    """
    try:
        pdf_reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        
        if not text.strip():
            raise Exception("No extractable text found in the PDF")
            
        return text, len(pdf_reader.pages)
    except Exception as e:
        raise Exception(f"Error parsing PDF file: {str(e)}")

def parse_docx(content: bytes) -> Tuple[str, int]:
    """
    Extract text from a DOCX file content.
    
    Args:
        content: The bytes content of the DOCX file
        
    Returns:
        Tuple[str, int]: Extracted text content and estimated number of pages
    """
    try:
        doc = Document(io.BytesIO(content))
        paragraphs = [para.text for para in doc.paragraphs]
        text = "\n".join(paragraphs)
        
        if not text.strip():
            raise Exception("No text found in the DOCX file")
            
        # Estimate pages (rough approximation based on character count)
        estimated_pages = max(1, len(text) // 3000)
        return text, estimated_pages
    except Exception as e:
        raise Exception(f"Error parsing DOCX file: {str(e)}")

def parse_odt(content: bytes) -> Tuple[str, int]:
    """
    Extract text from an ODT file content.
    
    Args:
        content: The bytes content of the ODT file
        
    Returns:
        Tuple[str, int]: Extracted text content and estimated number of pages
    """
    try:
        # Create a temporary BytesIO object to load the ODT file
        with io.BytesIO(content) as buffer:
            textdoc = load(buffer)
            all_paragraphs = textdoc.getElementsByType(P)
            
            paragraphs_content = []
            for paragraph in all_paragraphs:
                # Each paragraph's text content is stored in child nodes
                # So we join all textual child nodes for this paragraph
                paragraphs_content.append("".join(
                    node.data for node in paragraph.childNodes 
                    if node.nodeType == node.TEXT_NODE
                ))
            
            text = "\n".join(paragraphs_content)
            if not text.strip():
                raise Exception("No text found in the ODT file")
                
            # Estimate pages (rough approximation based on character count)
            estimated_pages = max(1, len(text) // 3000)
            return text, estimated_pages
    except Exception as e:
        raise Exception(f"Error parsing ODT file: {str(e)}")

def parse_text(content: bytes) -> Tuple[str, int]:
    """
    Extract text from a plain text or markdown file content.
    
    Args:
        content: The bytes content of the text file
        
    Returns:
        Tuple[str, int]: Extracted text content and page count (always 1 for text files)
    """
    try:
        try:
            text = content.decode('utf-8')
        except UnicodeDecodeError:
            # Try with different encoding if UTF-8 fails
            text = content.decode('latin-1')
            
        if not text.strip():
            raise Exception("File is empty")
            
        return text, 1
    except Exception as e:
        raise Exception(f"Error parsing text file: {str(e)}")

def parse_document(content: bytes, file_ext: str) -> Tuple[str, int]:
    """
    Parse any supported document type and extract its text content.
    
    Args:
        content: The bytes content of the file
        file_ext: The file extension (without the dot)
        
    Returns:
        Tuple[str, int]: Extracted text content and page count
    """
    parsers = {
        'pdf': parse_pdf,
        'docx': parse_docx,
        'odt': parse_odt,
        'txt': parse_text,
        'md': parse_text
    }
    
    if file_ext not in parsers:
        raise Exception(f"Unsupported file type: {file_ext}")
        
    return parsers[file_ext](content) 