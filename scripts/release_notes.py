"""Draft release notes from the conventional commits since the last tag.

    python scripts/release_notes.py              # since the newest v* tag
    python scripts/release_notes.py --since v1.12.0
    python scripts/release_notes.py --whats-new 1.20.0   # also draft the in-app entry

Prints Markdown: "New" for feat:, "Fixes" for fix:, and anything marked
breaking (feat!: / BREAKING CHANGE) under "Heads up". Housekeeping (chore,
ci, test, refactor, docs, build, style) is left out: the notes are for
players. It's a draft for the release skill to show and edit, then use as the
annotated tag's message, which release.yml turns into the GitHub release body
(and the in-app update dialog shows).

With --whats-new, it also puts a draft entry for that version at the top of
frontend/lib/data/whats-new.json (the What's new dialog after an update):
the first new features as highlights, the rest as sections. Edit it into
player-friendly words and give each highlight an icon before tagging.
"""

import argparse
import json
import re
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path

WHATS_NEW = Path(__file__).resolve().parent.parent / "frontend" / "lib" / "data" / "whats-new.json"
MAX_HIGHLIGHTS = 6

SECTIONS = {"feat": "New", "fix": "Fixes", "perf": "Fixes"}
SUBJECT = re.compile(r"^(?P<type>\w+)(?:\([^)]*\))?(?P<breaking>!)?:\s*(?P<text>.+)$")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8", check=True).stdout


def last_tag() -> str | None:
    try:
        return git("describe", "--tags", "--abbrev=0", "--match", "v*").strip() or None
    except subprocess.CalledProcessError:
        return None


def grouped(commits: list[tuple[str, str]]) -> dict[str, list[str]]:
    """(subject, body) pairs, newest first as git log gives them, sorted into
    the notes' sections, oldest first so they read in the order things were built."""
    groups: dict[str, list[str]] = {"Heads up": [], "New": [], "Fixes": []}
    for subject, body in reversed(commits):
        match = SUBJECT.match(subject.strip())
        if not match:
            continue
        text = match["text"].strip()
        text = text[0].upper() + text[1:]
        if match["breaking"] or "BREAKING CHANGE" in body:
            groups["Heads up"].append(text)
        elif match["type"] in SECTIONS:
            groups[SECTIONS[match["type"]]].append(text)
    return groups


def draft_notes(commits: list[tuple[str, str]]) -> str:
    """The notes as Markdown."""
    groups = grouped(commits)
    parts = [f"## {title}\n" + "\n".join(f"- {item}" for item in items) for title, items in groups.items() if items]
    return "\n\n".join(parts) if parts else "Small fixes and improvements."


def whats_new_entry(commits: list[tuple[str, str]], version: str, day: date) -> dict:
    """A draft whats-new.json entry: heads-ups and new features first as highlights."""
    groups = grouped(commits)
    leading = groups["Heads up"] + groups["New"]
    highlights = (leading or groups["Fixes"])[:MAX_HIGHLIGHTS]
    rest = {"Also new": leading[MAX_HIGHLIGHTS:], "Fixes": groups["Fixes"] if leading else groups["Fixes"][MAX_HIGHLIGHTS:]}
    entry = {
        "version": version,
        "date": day.isoformat(),
        "highlights": [{"icon": "whats-new", "text": text} for text in highlights] or [{"icon": "whats-new", "text": "Small fixes and improvements."}],
    }
    sections = [{"title": title, "items": items} for title, items in rest.items() if items]
    if sections:
        entry["sections"] = sections
    return entry


def write_whats_new(entries: list[dict], path: Path = WHATS_NEW):
    path.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def add_whats_new(entry: dict, path: Path = WHATS_NEW) -> bool:
    """Put the entry first; False (and no change) if that version already has one."""
    entries = json.loads(path.read_text(encoding="utf-8"))
    if any(e["version"] == entry["version"] for e in entries):
        return False
    write_whats_new([entry, *entries], path)
    return True


def commits_since(tag: str | None) -> list[tuple[str, str]]:
    revisions = f"{tag}..HEAD" if tag else "HEAD"
    raw = git("log", revisions, "--format=%s%x1f%b%x1e")
    return [tuple(entry.strip("\n").split("\x1f", 1)) for entry in raw.split("\x1e") if entry.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--since", help="tag to start after (default: the newest v* tag)")
    parser.add_argument("--whats-new", metavar="VERSION", help="also draft this version's entry in whats-new.json")
    args = parser.parse_args()
    commits = commits_since(args.since or last_tag())
    print(draft_notes(commits))
    if args.whats_new:
        added = add_whats_new(whats_new_entry(commits, args.whats_new, datetime.now(timezone.utc).date()))
        state = "drafted" if added else "already has an entry for"
        print(f"\n{WHATS_NEW.name} {state} {args.whats_new}: edit its words and icons before tagging.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
