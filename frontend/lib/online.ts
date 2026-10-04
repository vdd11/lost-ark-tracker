/**
 * Features that go online. Each is opt-in, labeled, and listed in the README
 * ("Privacy and network"); add any new one there too.
 */

/** "on" / "off" once chosen; empty until then. */
export const UPDATE_CHECK_PREFERENCE = "online-update-check";
export const UPDATE_CHECK_CHOICES = ["", "on", "off"] as const;
/** The Lost Ark updates widget (server status, Steam news, X). Off by default. */
export const NEWS_PREFERENCE = "online-news";

export type UpdateCheckState = "on" | "off" | "ask";

/**
 * Whether to check GitHub for new versions. A saved choice wins. Without one,
 * people who already use the app keep the check they've always had, and a new
 * install asks first (nothing is fetched until they answer).
 */
export function updateCheckState(stored: string, hasCharacters: boolean): UpdateCheckState {
  if (stored === "on" || stored === "off") return stored;
  return hasCharacters ? "on" : "ask";
}
