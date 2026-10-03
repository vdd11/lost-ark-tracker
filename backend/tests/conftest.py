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
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture
def set_now(monkeypatch):
    """Freeze the API's clock at a given naive-UTC datetime."""
    def _set(moment):
        # Route modules import utc_now by name, so patch it everywhere it's used.
        for name, module in list(sys.modules.items()):
            if (name == "main" or name.startswith("routes.")) and hasattr(module, "utc_now"):
                monkeypatch.setattr(module, "utc_now", lambda: moment)
    return _set
