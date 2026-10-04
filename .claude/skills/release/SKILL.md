---
name: release
description: Cut a Lost Ark Tracker release (bump the version, draft player-facing notes, commit, tag). Use only when the user says to release, e.g. "release it" or "release it as 1.14.0".
---

# Release Lost Ark Tracker

Only run this when the user has asked for a release. Pushing the tag builds
and publishes downloads for everyone, so **ask before pushing**.

1. **Start clean.** On `main`, nothing uncommitted (`git status --short` is
   empty apart from `frontend/next-env.d.ts`, which is never committed), and up
   to date with `origin/main`. The last CI run on `main` should be green.

2. **Run every check:** `powershell -File scripts\check.ps1` (Windows) or
   `sh scripts/check.sh`. Stop and fix if anything fails.

3. **Pick the version.** Use the one the user gave. Otherwise propose one
   from the commits since the last tag (`git log $(git describe --tags --abbrev=0)..HEAD --oneline`):
   minor (`1.13.0` → `1.14.0`) when there's a `feat:`, patch when there are only
   fixes. Major only if the user says so.

4. **Draft the notes:** `python scripts/release_notes.py`. Tidy them for
   players: merge near-duplicates, drop internal-only items, keep it short.
   The first line of the tag message is a one-line summary, like earlier
   tags: `Lost Ark Tracker 1.14.0: tray icon, update dialog, weekly history`.
   Show the user the version and notes.

5. **Bump** `APP_VERSION` in `backend/version.py` (the only place it lives;
   CI also stamps it from the tag).

6. **Commit and tag** (annotated, message = summary line, blank line, notes):

   ```sh
   git commit -am "chore: release 1.14.0" -m "Co-Authored-By: ..."   # attribution line as configured
   git tag -a v1.14.0 -F <notes file>
   ```

7. **Ask before pushing.** Then `git push origin main` and
   `git push origin v1.14.0`. The tag triggers `.github/workflows/release.yml`:
   it builds Windows, macOS and Linux, smoke-tests each at the tagged version,
   and publishes the release with the tag message as its notes (which the
   in-app update dialog shows).

8. **Watch the release run** until it's green, then give the user the release
   link. If it fails, don't move the tag silently: say what broke and ask.
