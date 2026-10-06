# Security notes

The tracker is a small web server on your own computer with no login. These
are the protections it relies on, and what each one does and doesn't cover.

## Who can talk to the server

- **Only this computer.** It listens on `127.0.0.1`, so other machines on the
  network can't reach it.
- **Only requests addressed to this computer** (`backend/hosts.py`,
  `LocalHostOnlyMiddleware`). A web page can point its own domain at
  `127.0.0.1` ("DNS rebinding") to read our answers; its requests then carry
  that domain in the `Host` header, so anything but `127.0.0.1`, `localhost`
  or `[::1]` gets 400.
- **No changes from other websites** (`SameOriginWritesMiddleware`). Any page
  you visit could still *send* a simple cross-site request, such as a form
  POST or a `fetch` with no body, to `http://127.0.0.1:<port>`; it can't read
  the answer, but the request would still act: start an update, restore a
  backup, delete a character. Browsers say where such requests come from, so
  every POST, PUT, PATCH and DELETE is refused (403) when:
  - its `Origin` isn't this computer on the app's own port or a dev port
    (3000, 8000), including the opaque `null` origin; or
  - it has no `Origin` but `Sec-Fetch-Site` says `cross-site`.

  Programs that aren't browsers (curl, scripts, the smoke test) send neither
  header and are allowed: anything running on your computer can already read
  the database file.

## Updating in place ("Update now")

`backend/updater.py` only runs when you press **Update now**, and only in the
packaged app. Before it replaces anything:

- the release list must come from `api.github.com`, and the download and its
  `SHA256SUMS` from `github.com` (or GitHub's file hosts it redirects to,
  `objects.githubusercontent.com` / `release-assets.githubusercontent.com`),
  all over HTTPS; redirects anywhere else are refused;
- the download is capped at 200 MB (the app is about 30 MB);
- the file must match its line in `SHA256SUMS`.

**What the checksum does and doesn't prove.** `SHA256SUMS` is published in the
same GitHub release as the download. It catches a corrupted or truncated
download, a proxy or mirror that changed the file, or a release built without
its checksums. It does **not** protect against a compromised release: anyone
who could upload a bad file to the release could upload a matching
`SHA256SUMS` too. Code signing would close that gap by proving who built the
file (see `docs/signing.md`).

`LOST_ARK_TRACKER_RELEASES_API` (testing only) points the updater at a local
server; only then are plain-`http` loopback URLs accepted.
