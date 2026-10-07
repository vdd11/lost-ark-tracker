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


def test_drafts_a_whats_new_entry_and_puts_it_first(tmp_path):
    from datetime import date
    import json

    commits = [(f"feat: feature {n}", "") for n in range(8, 0, -1)] + [("fix: a fix", "")]
    entry = release_notes.whats_new_entry(commits, "9.9.0", date(2026, 11, 1))
    assert entry["version"] == "9.9.0" and entry["date"] == "2026-11-01"
    # The first six features are highlights; the rest and the fixes are sections.
    assert [h["text"] for h in entry["highlights"]] == [f"Feature {n}" for n in range(1, 7)]
    assert entry["sections"] == [
        {"title": "Also new", "items": ["Feature 7", "Feature 8"]},
        {"title": "Fixes", "items": ["A fix"]},
    ]

    path = tmp_path / "whats-new.json"
    path.write_text(json.dumps([{"version": "9.8.0", "date": "2026-10-01", "highlights": ["Old"]}]), encoding="utf-8")
    assert release_notes.add_whats_new(entry, path) is True
    assert [e["version"] for e in json.loads(path.read_text(encoding="utf-8"))] == ["9.9.0", "9.8.0"]
    # Never twice for the same version.
    assert release_notes.add_whats_new(entry, path) is False
    assert len(json.loads(path.read_text(encoding="utf-8"))) == 2


def test_fixes_only_release_still_gets_highlights():
    from datetime import date

    entry = release_notes.whats_new_entry([("fix: one", ""), ("chore: tidy", "")], "9.9.1", date(2026, 11, 2))
    assert [h["text"] for h in entry["highlights"]] == ["One"] and "sections" not in entry
