/** LOA Logs import settings, saved in this browser (see backend/loa_logs.py). */
export const LOA_KEYS = {
  enabled: "loa-logs-enabled",
  path: "loa-logs-path",
  /** JSON: LOA Logs boss name -> task id (0 = not a raid clear). */
  mapping: "loa-logs-mapping",
  /** ISO time of the last import; the next one only looks after it. */
  lastImport: "loa-logs-last-import",
} as const;

export function parseMapping(raw: string): Record<string, number> {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, id]) => Number.isInteger(id))) as Record<string, number>;
  } catch {
    return {};
  }
}
