import os, sys; sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
import asyncio
import sys
import types
import pytest

# --------------------
# Stub modules
# --------------------

class HTTPException(Exception):
    def __init__(self, status_code, detail):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail

class UploadFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._content = content
    async def read(self):
        return self._content

sys.modules['fastapi'] = types.SimpleNamespace(HTTPException=HTTPException, UploadFile=UploadFile)

# Stub document parser
sys.modules['processing.document_parser'] = types.SimpleNamespace(parse_document=lambda c, e: ("parsed", 1))

# Fake in-memory DB structures
DB = {"profiles": {}, "files": []}

class FakeProfile:
    def __init__(self, pid):
        self.id = pid

class FakeDBFile:
    def __init__(self, profile_id, filename, file_type, content, pages):
        self.profile_id = profile_id
        self.filename = filename
        self.file_type = file_type
        self.content = content
        self.pages = pages
        self.id = None
        self.created_at = "now"

class FakeSession:
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def query(self, model):
        self.model = model
        return self
    def filter_by(self, **kwargs):
        self.kwargs = kwargs
        return self
    def first(self):
        if self.model is FakeProfile:
            return DB["profiles"].get(self.kwargs.get("id"))
    def add(self, obj):
        obj.id = len(DB["files"]) + 1
        DB["files"].append(obj)
    def commit(self):
        pass

class SessionFactory:
    def __call__(self, engine):
        return FakeSession()

sys.modules['sqlalchemy'] = types.ModuleType('sqlalchemy')
sys.modules['sqlalchemy.orm'] = types.SimpleNamespace(Session=SessionFactory())

fake_models = types.ModuleType('storage.models')
fake_models.engine = object()
fake_models.Profile = FakeProfile
fake_models.File = FakeDBFile
sys.modules['storage.models'] = fake_models

from importlib import import_module
file_service = import_module('src.backend.services.file_service')


def test_upload_profile_file_service_success():
    DB["profiles"][1] = FakeProfile(1)
    file = UploadFile("test.txt", b"data")
    result = asyncio.run(file_service.upload_profile_file_service(1, file))
    assert result["filename"] == "test.txt"
    assert DB["files"][0].content == "parsed"
    assert result["pages"] == 1


def test_upload_profile_file_service_profile_not_found():
    DB["profiles"].clear()
    file = UploadFile("test.txt", b"data")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(file_service.upload_profile_file_service(1, file))
    assert exc.value.status_code == 404


def test_upload_profile_file_service_parse_error(monkeypatch):
    DB["profiles"][1] = FakeProfile(1)
    def bad_parse(content, ext):
        raise Exception("boom")
    monkeypatch.setattr(file_service, "parse_document", bad_parse)
    file = UploadFile("test.txt", b"data")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(file_service.upload_profile_file_service(1, file))
    assert exc.value.status_code == 400
