"""The exported frontend's cache headers: pages revalidate, hashed build files are kept."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from frontend_files import IMMUTABLE, FrontendFiles


def test_pages_revalidate_and_build_files_are_kept(tmp_path):
    (tmp_path / "index.html").write_text("<p>tracker</p>", encoding="utf-8")
    (tmp_path / "_next" / "static" / "chunks").mkdir(parents=True)
    (tmp_path / "_next" / "static" / "chunks" / "app-1a2b.js").write_text("x", encoding="utf-8")
    app = FastAPI()
    app.mount("/", FrontendFiles(directory=tmp_path, html=True), name="frontend")
    client = TestClient(app)

    page = client.get("/")
    assert page.status_code == 200 and page.headers["cache-control"] == "no-cache"
    built = client.get("/_next/static/chunks/app-1a2b.js")
    assert built.headers["cache-control"] == IMMUTABLE
    # A revalidated page that hasn't changed is a cheap 304.
    again = client.get("/", headers={"If-None-Match": page.headers["etag"]})
    assert again.status_code == 304
