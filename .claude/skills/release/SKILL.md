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

4. **Draft the notes:** `python scripts/release_notes.py --whats-new <version>`.
   Tidy them for players: merge near-duplicates, drop internal-only items,
   keep it short. The same run puts a draft entry for the version at the top
   of `frontend/lib/data/whats-new.json` (the What's new dialog players see
   once after updating): rewrite it in player words, 3-6 highlights, and give
   each an icon (a `GameIcon` name). A test fails if `APP_VERSION` has no entry.
   The first line of the tag message is a one-line summary, like earlier
   tags: `Lost Ark Tracker 1.14.0: tray icon, update dialog, weekly history`.
   Show the user the version and notes.

5. **Bump** `APP_VERSION` in `backend/version.py` (the only place it lives;
   CI also stamps it from the tag).

6. **Commit and tag** (annotated, message = summary line, blank line, notes):

   ```sh
   git commit -am "chore: release 1.14.0" -m "Co-Authored-By: ..."   # attribution line as configured
   git tag -a v1.14.0 --cleanup=whitespace -F <notes file>
   ```

   `--cleanup=whitespace` matters: by default git drops lines starting with
   `#` as comments, which would strip the notes' `## New` headings.

7. **Ask before pushing.** Then `git push origin main` and
   `git push origin v1.14.0`. The tag triggers `.github/workflows/release.yml`:
   it builds Windows, macOS and Linux, smoke-tests each at the tagged version,
   and makes a **draft** release with the tag message as its notes (which the
   in-app update dialog shows) and `SHA256SUMS`.

8. **Watch the release run** until it's green. If it fails, don't move the tag
   silently: say what broke and ask.

9. **The user signs and publishes it.** The signing key is on their computer
   and the step needs their GitHub token, so don't run it yourself; give them
   the command to run with `!`:

   ```sh
   ! GITHUB_TOKEN=<token> backend/.venv/Scripts/python scripts/sign_release.py publish v1.14.0
   ```

   (A fine-grained token for this repo with Contents: read and write.) It
   checks every download against `SHA256SUMS`, signs it, uploads
   `SHA256SUMS.sig` and publishes the release. Until then the release is a
   draft that nobody sees. Then give them the release link.
