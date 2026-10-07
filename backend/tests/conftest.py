import os
import sys
import tempfile
from pathlib import Path

import pytest

# Point the app at a throwaway database before it is imported.
_db_dir = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_db_dir) / 'test.db'}"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from database import Base, engine  # noqa: E402


@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)
    with TestClient(main.app, base_url="http://127.0.0.1") as test_client:
        yield test_client


@pytest.fixture
def set_now(monkeypatch):
    """Freeze the API's clock at a given naive-UTC datetime."""
    backend = str(Path(__file__).resolve().parent.parent)

    def _set(moment):
        # Modules import utc_now by name, so patch it in every app module that
        # has it (routes, and domain modules like history.py), never the real
        # clock in resets.py itself or in libraries.
        for name, module in list(sys.modules.items()):
            path = getattr(module, "__file__", None) or ""
            in_app = path.startswith(backend) and ".venv" not in path
            if name != "resets" and in_app and hasattr(module, "utc_now"):
                monkeypatch.setattr(module, "utc_now", lambda: moment)
    return _set
