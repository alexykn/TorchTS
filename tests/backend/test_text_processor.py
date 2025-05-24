import os, sys; sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
import sys
import types

# Stub rich to avoid missing dependency
sys.modules['rich'] = types.SimpleNamespace(print=lambda *a, **k: None)

from src.backend.processing import text_processor


def test_chunk_text_splits_long_text():
    text = (
        "Hello world! This is a test that is purposely long, to check splitting. "
        "Another sentence here."
    )
    chunks = text_processor.chunk_text(text, max_tokens=50)
    assert len(chunks) > 1
    assert all(len(c) <= 50 for c in chunks)


def test_chunk_text_handles_overlong_sentence():
    long_sentence = " ".join(["word"] * 100) + "."
    chunks = text_processor.chunk_text(long_sentence, max_tokens=40)
    assert all(len(c) <= 40 for c in chunks)
