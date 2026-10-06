"""Updating the packaged app in place (the update dialog's "Update now")."""

import logging
import sys
import threading

from fastapi import APIRouter, HTTPException

import updater
from database import backup_database
from version import APP_VERSION

router = APIRouter(prefix="/api")
log = logging.getLogger(__name__)

# Long enough for the response to reach the browser before this copy stops.
EXIT_DELAY_SECONDS = 1.0


@router.get("/update/status")
def update_status():
    """Whether this copy can update itself: only the downloaded app can, not a run from source."""
    exe = updater.running_executable()
    return {"supported": exe is not None, "current": APP_VERSION, "asset": updater.asset_name()}


@router.post("/update/install")
def install_update():
    exe = updater.running_executable()
    if exe is None:
        raise HTTPException(status_code=400, detail="Only the downloaded app can update itself.")
    backup_database()  # today's copy, if startup hasn't made it already
    try:
        version = updater.install_update(exe)
    except updater.UpdateError as error:
        log.warning("Update failed: %s", error)
        raise HTTPException(status_code=400, detail=str(error))
    try:
        updater.start_new_copy(exe, sys.argv[1:])
    except OSError as error:
        log.exception("Couldn't start the updated app")
        raise HTTPException(status_code=500, detail=f"Updated to {version}, but couldn't restart it ({error}). Close and reopen the app.")
    if updater.request_exit is not None:
        threading.Timer(EXIT_DELAY_SECONDS, updater.request_exit).start()
    return {"version": version}
