/** What the app runs on, as GET /api/ reports it. */
export type Platform = "windows" | "macos" | "linux";

export type ReleaseAsset = { name: string; url: string };

export type Release = {
  version: string;
  url: string;
  notes: string;
  assets: ReleaseAsset[];
};

export type NoteLine = { kind: "heading" | "item" | "text"; text: string };

const PLATFORM_LABELS: Record<Platform, string> = { windows: "Windows", macos: "macOS", linux: "Linux" };

export function platformLabel(platform: Platform) {
  return PLATFORM_LABELS[platform];
}

/** The parts of a GitHub "latest release" response the update dialog needs. */
export function parseRelease(data: {
  tag_name?: unknown;
  html_url?: unknown;
  body?: unknown;
  assets?: { name?: unknown; browser_download_url?: unknown }[];
}): Release {
  return {
    version: String(data.tag_name ?? "").replace(/^v/, ""),
    url: String(data.html_url ?? ""),
    notes: typeof data.body === "string" ? data.body : "",
    assets: (data.assets ?? [])
      .filter((asset) => typeof asset.name === "string" && typeof asset.browser_download_url === "string")
      .map((asset) => ({ name: asset.name as string, url: asset.browser_download_url as string })),
  };
}

/** The download built for this platform (release.yml names them LostArkTracker-<platform>[.exe]). */
export function assetFor(assets: ReleaseAsset[], platform: Platform | null): ReleaseAsset | null {
  if (!platform) return null;
  return assets.find((asset) => asset.name.toLowerCase().includes(`-${platform}`)) ?? null;
}

/**
 * Release notes as plain lines: headings, bullet items and text. Markdown
 * emphasis and links are reduced to their text, GitHub's "by @someone in
 * <PR link>" tails and the "Full Changelog" link are dropped, so nothing in
 * the notes is rendered as HTML or turned into a link.
 */
export function releaseNoteLines(notes: string): NoteLine[] {
  const lines: NoteLine[] = [];
  for (const raw of notes.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /full changelog/i.test(line) || /^<!--.*-->$/.test(line)) continue;
    const clean = (text: string) =>
      text
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\s+by @[\w-]+ in https?:\/\/\S+$/, "")
        .replace(/\*\*|__|`/g, "")
        .trim();
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const item = line.match(/^[-*+]\s+(.*)$/);
    if (heading) lines.push({ kind: "heading", text: clean(heading[1]) });
    else if (item) lines.push({ kind: "item", text: clean(item[1]) });
    else lines.push({ kind: "text", text: clean(line) });
  }
  return lines.filter((line) => line.text);
}

/** The release page for a version, which has its notes. A plain link: nothing is fetched. */
export function releasePage(version: string) {
  return `https://github.com/vdd11/lost-ark-tracker/releases/tag/v${version}`;
}

/** The release files the in-app updater checks downloads against: checksums, and their signature. */
export const CHECKSUMS_ASSET = "SHA256SUMS";
export const SIGNATURE_ASSET = "SHA256SUMS.sig";

/** "Update now" needs a copy that can replace itself and a release it can verify (signed checksums). */
export function canUpdateInPlace(release: Release, supported: boolean) {
  const names = new Set(release.assets.map((asset) => asset.name));
  return supported && names.has(CHECKSUMS_ASSET) && names.has(SIGNATURE_ASSET);
}

/**
 * After "Update now", the app restarts: wait until it answers at the new
 * version (true), or give up after `tries` (false).
 */
export async function waitForVersion(
  version: string,
  currentVersion: () => Promise<string | null>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  tries = 90,
) {
  for (let i = 0; i < tries; i++) {
    await sleep(1000);
    try {
      if ((await currentVersion()) === version) return true;
    } catch {
      // Not up yet.
    }
  }
  return false;
}
