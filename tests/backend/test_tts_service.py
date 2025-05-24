import os, sys; sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
import sys
import types
import pytest

# --------------------
# Stub external modules
# --------------------

class HTTPException(Exception):
    def __init__(self, status_code, detail):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail

class StreamingResponse:
    def __init__(self, buffer, media_type=None, headers=None):
        self.buffer = buffer
        self.media_type = media_type
        self.headers = headers or {}

sys.modules['fastapi'] = types.SimpleNamespace(HTTPException=HTTPException)
sys.modules['fastapi.responses'] = types.SimpleNamespace(StreamingResponse=StreamingResponse)

class FakeNumpyArray(list):
    def __mul__(self, scalar):
        return FakeNumpyArray([x * scalar for x in self])
    __rmul__ = __mul__
    def astype(self, dtype):
        return self

class FakeNumpy(types.SimpleNamespace):
    int16 = 'int16'
    @staticmethod
    def concatenate(arrays):
        data = []
        for arr in arrays:
            data.extend(arr)
        return FakeNumpyArray(data)

sys.modules['numpy'] = FakeNumpy()
sys.modules['soundfile'] = types.SimpleNamespace(write=lambda buf, data, sr, format=None, subtype=None: buf.write(b'wav'))

# Use real chunk_text with stubbed rich
sys.modules['rich'] = types.SimpleNamespace(print=lambda *a, **k: None)
from src.backend.processing.text_processor import chunk_text
sys.modules['processing.text_processor'] = types.ModuleType('processing.text_processor')
sys.modules['processing.text_processor'].chunk_text = chunk_text

sys.modules['processing.audio_generator'] = types.SimpleNamespace(normalize_audio=lambda x, eps=1e-8: x)

def fake_pipeline(text, voice=None, speed=1.0):
    yield 0, 0, FakeNumpyArray([0.1, 0.2])

fake_main = types.ModuleType('main')
fake_main.pipelines = {'a': fake_pipeline, 'b': fake_pipeline}
sys.modules['main'] = fake_main

from importlib import import_module
tts_service = import_module('src.backend.services.tts_service')

class Request:
    def __init__(self, text, voice, chunk_id=0, speed=1.0):
        self.text = text
        self.voice = voice
        self.chunk_id = chunk_id
        self.speed = speed


def test_generate_single_tts_success():
    req = Request('hello there', 'a_voice')
    resp = tts_service.generate_single_tts(req)
    assert isinstance(resp, StreamingResponse)
    assert resp.headers['X-Total-Chunks'] == '1'
    assert resp.headers['X-Current-Chunk'] == '0'


def test_generate_single_tts_invalid_voice():
    req = Request('hi', 'c_voice')
    with pytest.raises(HTTPException) as exc:
        tts_service.generate_single_tts(req)
    assert exc.value.status_code == 400
