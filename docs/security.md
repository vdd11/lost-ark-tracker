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
- `SHA256SUMS` must carry a valid signature (`SHA256SUMS.sig`) from a key in
  `update_signing.PUBLIC_KEYS`;
- the file must match its line in `SHA256SUMS`.

**Signed checksums.** The checksum alone catches a corrupted or truncated
download, or a proxy that changed the file, but it's published in the same
release, so whoever could upload a bad file could upload matching checksums.
The signature closes that gap. It's an Ed25519 signature made on the
developer's own computer with a private key that never goes to GitHub
(`scripts/sign_release.py`, default `~/.lost-ark-tracker/update-signing-key.pem`).
The release workflow only makes a **draft** release, which the app's update
check can't see. The developer runs `sign_release.py publish vX.Y.Z`, which
checks every download against `SHA256SUMS`, signs it, uploads the signature
and publishes the release. So taking over the GitHub account, a workflow or
an action used by the build is not enough to push an update through the app.
Those people could still publish a bad release for manual download, so the
account needs 2FA too.

- **Key backup:** without the private key, the app can't update itself;
  people would download the next version by hand. Keep a copy in a password
  manager.
- **New key:** add its public key to `PUBLIC_KEYS` beside the old one, ship
  that release signed with the old key, then sign later releases with the new
  one.
- **Not covered:** this proves the update came from the developer, not that
  Windows trusts the file. That's code signing (`docs/signing.md`).

**Build supply chain.** Every GitHub Action in the workflows is pinned to a
commit (a tag can be moved, a commit can't), and Dependabot proposes updates
monthly. Workflows default to read-only, and only the job that publishes the
release can write.

`LOST_ARK_TRACKER_RELEASES_API` (testing only) points the updater at a local
server; only then are plain-`http` loopback URLs accepted.
