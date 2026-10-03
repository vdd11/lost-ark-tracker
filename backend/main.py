import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import Base, SessionLocal, add_missing_columns, backup_database, engine
from raids import sync_catalog
from seed import apply_default_rest_rules, seed_default_tasks
from version import APP_NAME, APP_VERSION
from routes import backup, characters, difficulties, events, gems, gold, tasks, tracker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Back up first, then create any new tables, upgrade existing ones, and
    # add the default tasks.
    backup_database()
    Base.metadata.create_all(bind=engine)
    added_columns = add_missing_columns()
    with SessionLocal() as db:
        seed_default_tasks(db)
        # Databases from before rest tracking get the default rules once.
        if ("tasks", "rest_max") in added_columns:
            apply_default_rest_rules(db)
        sync_catalog(db)
    yield


app = FastAPI(title=APP_NAME, version=APP_VERSION, lifespan=lifespan)

# Allow the Next.js frontend to communicate with our API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


router = APIRouter(prefix="/api")


@router.get("/")
def root():
    return {"app": APP_NAME, "version": APP_VERSION}


app.include_router(router)
for module in (characters, tasks, tracker, gold, events, gems, difficulties, backup):
    app.include_router(module.router)


# In the packaged app, the exported Next.js frontend is served from the same
# server. Mounted last so the /api routes above take priority.
FRONTEND_DIR = os.environ.get("FRONTEND_DIR")
if FRONTEND_DIR and Path(FRONTEND_DIR).is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
