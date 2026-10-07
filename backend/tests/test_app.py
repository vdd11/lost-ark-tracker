"""The desktop launcher: how it reports errors and how the tray quits."""

from pathlib import Path

import app
import tray


def test_errors_go_to_a_message_box_when_there_is_no_console(monkeypatch):
    shown = []
    monkeypatch.setattr(app, "HAS_CONSOLE", False)
    monkeypatch.setattr(app, "message_box", lambda text, **kwargs: shown.append((text, kwargs)))
    app.wait_before_closing("Lost Ark Tracker stopped because of an error.")
    assert shown == [("Lost Ark Tracker stopped because of an error.", {"error": True})]


def test_errors_print_when_there_is_a_console(monkeypatch, capsys):
    monkeypatch.setattr(app, "HAS_CONSOLE", True)
    app.wait_before_closing("Something went wrong.")
    assert "Something went wrong." in capsys.readouterr().out


def test_quit_stops_the_server_and_the_icon():
    stopped = []

    class FakeIcon:
        def stop(self):
            stopped.append("icon")

    menu = tray.Tray("http://127.0.0.1:1/", Path("."), Path("tracker.log"), on_quit=lambda: stopped.append("server"))
    menu.icon = FakeIcon()
    menu.quit()
    assert stopped == ["server", "icon"]


def test_icon_is_drawn(monkeypatch):
    if not tray.tray_supported():
        return  # Pillow is only installed for the Windows build
    image = tray.icon_image()
    assert image.size == (256, 256) and image.getpixel((128, 12))[3] == 255  # the shipped icon
