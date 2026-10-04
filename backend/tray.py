"""The packaged Windows app's system tray icon, instead of a console window.

Right-click (or click) the icon for: Open tracker, Open data folder, Open log,
Quit. macOS and Linux builds keep the console window: pystray's backends there
need extra system libraries (or AppKit on the main thread), so they fall back.
"""

import ctypes
import logging
import os
import sys
import threading
import webbrowser
from collections.abc import Callable
from pathlib import Path

from version import APP_NAME

logger = logging.getLogger(__name__)

# Set by the self-test (tests and CI only): quit by itself after this many seconds.
SELFTEST_ENV = "LAT_TRAY_SELFTEST_SECONDS"


def tray_supported() -> bool:
    if sys.platform != "win32":
        return False
    try:
        import pystray  # noqa: F401
        from PIL import Image  # noqa: F401
    except ImportError:
        return False
    return True


def message_box(text: str, title: str = APP_NAME, error: bool = False):
    """A plain Windows message box, for when there's no console to print to."""
    if sys.platform != "win32":
        return
    icon = 0x10 if error else 0x40  # MB_ICONERROR / MB_ICONINFORMATION
    ctypes.windll.user32.MessageBoxW(None, text, title, icon)


def icon_image():
    """A small gold "LA" badge, drawn rather than shipped as a file."""
    from PIL import Image, ImageDraw

    size = 64
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((2, 2, size - 2, size - 2), radius=14, fill=(224, 180, 76, 255))
    draw.text((size / 2, size / 2), "LA", fill=(23, 23, 23, 255), anchor="mm", font_size=30)
    return image


class Tray:
    """The tray icon and its menu. `run()` blocks until Quit."""

    def __init__(self, url: str, data_dir: Path, log_path: Path, on_quit: Callable[[], None]):
        self.url = url
        self.data_dir = data_dir
        self.log_path = log_path
        self.on_quit = on_quit
        self.icon = None

    def open_tracker(self, *_):
        webbrowser.open(self.url)

    def open_data_folder(self, *_):
        os.startfile(self.data_dir)  # noqa: S606 - Windows only, a folder we own

    def open_log(self, *_):
        os.startfile(self.log_path)  # noqa: S606 - Windows only, a file we own

    def quit(self, *_):
        logger.info("Quit from the tray")
        self.on_quit()
        if self.icon is not None:
            self.icon.stop()

    def run(self):
        import pystray

        menu = pystray.Menu(
            pystray.MenuItem("Open tracker", self.open_tracker, default=True),
            pystray.MenuItem("Open data folder", self.open_data_folder),
            pystray.MenuItem("Open log", self.open_log),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", self.quit),
        )
        self.icon = pystray.Icon("LostArkTracker", icon_image(), f"{APP_NAME} – {self.url}", menu)

        def setup(icon):
            icon.visible = True
            try:
                icon.notify("Running in the tray. Right-click the icon to open or quit.", APP_NAME)
            except Exception:  # noqa: BLE001 - a missing balloon isn't worth failing over
                logger.info("Tray notification not shown", exc_info=True)
            seconds = os.environ.get(SELFTEST_ENV)
            if seconds:
                threading.Timer(float(seconds), self.quit).start()

        self.icon.run(setup=setup)
