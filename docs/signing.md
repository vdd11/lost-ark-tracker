# Code signing and notarization

The downloads aren't signed today, which is why the README tells people to
click through SmartScreen on Windows and run `xattr` on macOS. This page
covers what signing would take, what it costs and what would change in
`.github/workflows/release.yml`. Nothing here is set up yet.

Prices and eligibility rules change; check the linked providers before
paying for anything. (Written October 2026.)

## What signing buys us

| | Unsigned (today) | Signed |
|---|---|---|
| Windows | "Windows protected your PC" until the file gains reputation; some antivirus tools flag PyInstaller exes | Publisher name shown; SmartScreen warnings fade as the certificate earns reputation (no longer instant, even with EV) |
| macOS | Blocked by Gatekeeper; needs `chmod +x` + `xattr` in Terminal | Opens normally once signed **and** notarized |
| Linux | No prompt | No change (nobody checks) |

It would also make the in-app **Update now** (`backend/updater.py`, since
1.19) safer to rely on: an unsigned exe that replaces itself is a pattern
antivirus heuristics can flag. Today it only installs a download whose SHA-256
matches the release's `SHA256SUMS` (made by `release.yml`), and only when the
user presses the button; the checksums themselves are signed with the
developer's own key (`docs/security.md`), so the app already knows who
published an update. Code signing would add a publisher Windows and macOS trust.

## Free, do first: checksums and build provenance

These cost nothing, need no accounts, and let anyone verify a download came
from this repo's release workflow. They don't remove the OS warnings.

```yaml
# release.yml, build job, after "Rename binary":
      - uses: actions/attest-build-provenance@v2
        with:
          subject-path: dist/${{ matrix.asset }}
# the job also needs: permissions: { id-token: write, attestations: write, contents: write }

# release job, before the release step:
      - run: cd assets && sha256sum * > SHA256SUMS.txt
```

Anyone can then run `gh attestation verify LostArkTracker-windows.exe -R vdd11/lost-ark-tracker`.

## Windows

Pick one:

| Option | Cost | Notes |
|---|---|---|
| **Azure Trusted Signing** | about $10/month (Basic) | Microsoft's managed signing. Certificates are short-lived and handled for you; no hardware token. Identity validation required; eligibility has been limited by country and (for individuals) has changed during its rollout, so check it first. Has an official GitHub Action. **Recommended if eligible.** |
| **SignPath Foundation** | Free for open-source projects | They sign with a certificate in the foundation's name after reviewing the project; builds must come from CI (which ours do). Approval isn't guaranteed and the publisher shown is SignPath Foundation, not you. |
| OV certificate from a CA (Sectigo, DigiCert, SSL.com, ...) | roughly $200–500/year | Since 2023 the private key must live on a hardware token or a cloud HSM, so CI needs the CA's cloud signing service. EV no longer gives instant SmartScreen reputation, so it isn't worth the extra cost here. |

### Release workflow with Trusted Signing

One-time setup in Azure: create a Trusted Signing account and certificate
profile, finish identity validation, and add a federated credential (OIDC) for
this repo's `release.yml`, so no long-lived secret is stored in GitHub.

Repository secrets: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`,
`AZURE_SUBSCRIPTION_ID`. Then in the build job, after `python build.py` and
**before** the smoke test (so the test runs the signed file):

```yaml
      - uses: azure/login@v2
        if: runner.os == 'Windows'
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - uses: azure/trusted-signing-action@v0
        if: runner.os == 'Windows'
        with:
          endpoint: https://eus.codesigning.azure.net/   # your account's region
          trusted-signing-account-name: <account>
          certificate-profile-name: <profile>
          files: ${{ github.workspace }}\dist\LostArkTracker.exe
          file-digest: SHA256
          timestamp-rfc3161: http://timestamp.acs.microsoft.com
          timestamp-digest: SHA256
# the job needs: permissions: { id-token: write, contents: write }
```

Sign only the final one-file exe. PyInstaller's bootloader is what Windows
checks; the files it unpacks at runtime aren't checked separately.

## macOS

Needs the **Apple Developer Program** ($99/year) and a **Developer ID
Application** certificate. Signing alone isn't enough: the build must also be
**notarized** (uploaded to Apple, scanned, approved), or Gatekeeper still
blocks it.

A bare command-line binary like today's `LostArkTracker-macos` can be signed
and notarized, but the notarization ticket can't be stapled to it, so the
first launch needs Apple's servers to confirm it. The smoother path is a real
app bundle:

1. Build an `.app` (PyInstaller `--windowed`, in one-folder mode: one-file
   `.app` bundles are deprecated in PyInstaller).
2. Sign with the hardened runtime, plus the entitlements PyInstaller apps
   need (typically `com.apple.security.cs.allow-unsigned-executable-memory`
   and `com.apple.security.cs.disable-library-validation`; trim what isn't
   needed).
3. Put it in a `.dmg` (or zip), notarize with `notarytool`, then staple.

The tray icon (4.1) is Windows-only for now; an `.app` with no Terminal
window would want the macOS equivalent, a menu bar icon, at the same time.

Repository secrets: `MACOS_CERT_P12` (base64 of the exported certificate),
`MACOS_CERT_PASSWORD`, `APPLE_ID`, `APPLE_TEAM_ID`, and
`APPLE_APP_PASSWORD` (an app-specific password), or an App Store Connect API
key instead of the last three.

```yaml
      - name: Sign and notarize (macOS)
        if: runner.os == 'macOS'
        env:
          MACOS_CERT_P12: ${{ secrets.MACOS_CERT_P12 }}
          MACOS_CERT_PASSWORD: ${{ secrets.MACOS_CERT_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_APP_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
        run: |
          # A throwaway keychain holding the certificate for this run only
          echo "$MACOS_CERT_P12" | base64 --decode > cert.p12
          security create-keychain -p ci build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p ci build.keychain
          security import cert.p12 -k build.keychain -P "$MACOS_CERT_PASSWORD" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple: -s -k ci build.keychain
          codesign --force --deep --options runtime --timestamp \
            --entitlements packaging/entitlements.plist \
            --sign "Developer ID Application: <Name> ($APPLE_TEAM_ID)" "dist/Lost Ark Tracker.app"
          hdiutil create -volname "Lost Ark Tracker" -srcfolder "dist/Lost Ark Tracker.app" -ov dist/LostArkTracker-macos.dmg
          xcrun notarytool submit dist/LostArkTracker-macos.dmg --wait \
            --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_PASSWORD"
          xcrun stapler staple dist/LostArkTracker-macos.dmg
```

`build.py`, the smoke test (it would launch the binary inside the `.app`)
and the matrix's `asset` / `binary` names would change with it. Note also that
`macos-latest` runners are Apple Silicon, so today's macOS download is
arm64-only; Intel Macs would need a `universal2` Python or a second runner.

## Linux

Nothing prompts, so there's nothing to buy. The checksums and provenance
above cover verification.

## Suggested order

1. Checksums + provenance attestations (free, a few lines).
2. Windows via Trusted Signing if eligible, otherwise apply to SignPath
   Foundation. Most players are on Windows, so this removes most of the
   friction.
3. macOS only if there are Mac players asking: it's $99/year plus the `.app`
   rework above.
4. With signed builds, the in-app updater can also check the signature before swapping.
