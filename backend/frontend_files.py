"""Serving the exported frontend so an update shows up at once.

Without cache headers, browsers guess how long to keep a page and can show
the old version after an update (or a blank one, if the old page points at
build files that are gone). Pages and other files are checked with the
server every time (cheap: it answers "not modified"); the hashed build files
under /_next/static/ never change, so browsers keep them.
"""

from fastapi.staticfiles import StaticFiles

IMMUTABLE = "public, max-age=31536000, immutable"


class FrontendFiles(StaticFiles):
    def file_response(self, full_path, stat_result, scope, status_code=200):
        response = super().file_response(full_path, stat_result, scope, status_code)
        response.headers["Cache-Control"] = IMMUTABLE if scope["path"].startswith("/_next/static/") else "no-cache"
        return response
