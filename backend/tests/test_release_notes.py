"""scripts/release_notes.py: drafting player-facing notes from commit subjects."""

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "release_notes.py"
spec = importlib.util.spec_from_file_location("release_notes", SCRIPT)
release_notes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_notes)


def test_groups_features_and_fixes_oldest_first():
    commits = [  # newest first, as git log lists them
        ("fix: gold goal counts bound gold", ""),
        ("chore: release 1.13.0", ""),
        ("feat(tracker): undo toast for ticks", ""),
        ("feat: keyboard shortcuts", ""),
    ]
    assert release_notes.draft_notes(commits) == (
        "## New\n- Keyboard shortcuts\n- Undo toast for ticks\n\n## Fixes\n- Gold goal counts bound gold"
    )


def test_breaking_changes_come_first():
    commits = [
        ("feat: tray icon", ""),
        ("feat!: new backup format", ""),
        ("fix: data folder moved", "BREAKING CHANGE: old path no longer read"),
    ]
    notes = release_notes.draft_notes(commits)
    assert notes.startswith("## Heads up\n- Data folder moved\n- New backup format\n\n## New\n- Tray icon")


def test_housekeeping_only_still_says_something():
    commits = [("ci: cache pip", ""), ("refactor: split pages", ""), ("not conventional", "")]
    assert release_notes.draft_notes(commits) == "Small fixes and improvements."
