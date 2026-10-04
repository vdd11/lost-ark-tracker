"""Draft release notes from the conventional commits since the last tag.

    python scripts/release_notes.py              # since the newest v* tag
    python scripts/release_notes.py --since v1.12.0

Prints Markdown: "New" for feat:, "Fixes" for fix:, and anything marked
breaking (feat!: / BREAKING CHANGE) under "Heads up". Housekeeping (chore,
ci, test, refactor, docs, build, style) is left out: the notes are for
players. It's a draft for the release skill to show and edit, then use as the
annotated tag's message, which release.yml turns into the GitHub release body
(and the in-app update dialog shows).
"""

import argparse
import re
import subprocess
import sys

SECTIONS = {"feat": "New", "fix": "Fixes", "perf": "Fixes"}
SUBJECT = re.compile(r"^(?P<type>\w+)(?:\([^)]*\))?(?P<breaking>!)?:\s*(?P<text>.+)$")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8", check=True).stdout


def last_tag() -> str | None:
    try:
        return git("describe", "--tags", "--abbrev=0", "--match", "v*").strip() or None
    except subprocess.CalledProcessError:
        return None


def draft_notes(commits: list[tuple[str, str]]) -> str:
    """Notes from (subject, body) pairs, newest first as git log gives them;
    listed oldest first so they read in the order things were built."""
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
    parts = [f"## {title}\n" + "\n".join(f"- {item}" for item in items) for title, items in groups.items() if items]
    return "\n\n".join(parts) if parts else "Small fixes and improvements."


def commits_since(tag: str | None) -> list[tuple[str, str]]:
    revisions = f"{tag}..HEAD" if tag else "HEAD"
    raw = git("log", revisions, "--format=%s%x1f%b%x1e")
    return [tuple(entry.strip("\n").split("\x1f", 1)) for entry in raw.split("\x1e") if entry.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--since", help="tag to start after (default: the newest v* tag)")
    args = parser.parse_args()
    print(draft_notes(commits_since(args.since or last_tag())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
