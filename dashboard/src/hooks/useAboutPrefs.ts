const KEY = "pc-about-prefs";

export type AboutPrefs = {
  /** Contents rail collapsed to a strip on wide screens. */
  railCollapsed: boolean;
  /** Section ids whose detail is open. */
  expanded: Record<string, boolean>;
};

const DEFAULTS: AboutPrefs = { railCollapsed: false, expanded: {} };

/**
 * Per-viewer conveniences only (REQ9.3). Storage can be missing, blocked or
 * full, so every access is guarded and the page works without it.
 */
export function readAboutPrefs(): AboutPrefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AboutPrefs>;
    return {
      railCollapsed: parsed.railCollapsed === true,
      expanded: parsed.expanded && typeof parsed.expanded === "object" ? parsed.expanded : {},
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeAboutPrefs(prefs: AboutPrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private window, blocked storage or quota: the page still works.
  }
}
