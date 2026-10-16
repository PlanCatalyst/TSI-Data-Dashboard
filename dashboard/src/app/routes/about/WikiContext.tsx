import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { SECTIONS, resolveAnchor } from "../../../content/about";
import { readAboutPrefs, writeAboutPrefs } from "../../../hooks/useAboutPrefs";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { useDashboardData } from "../../../state/dashboard-context";
import type { Facts } from "./rich";

/**
 * State shared by the rail, the sections and the inline controls: which
 * sections' detail is open, whether the rail is shown, the filter text and the
 * section in view. Rail and expanded state are per-viewer conveniences and the
 * page works without storage (REQ9.1, REQ9.3).
 */

type WikiState = {
  facts: Facts;
  /** True at 1024 px and wider. */
  wide: boolean;
  railOpen: boolean;
  setRailOpen: (open: boolean) => void;
  expanded: Record<string, boolean>;
  isExpanded: (sectionId: string) => boolean;
  setExpanded: (sectionId: string, open: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;
  query: string;
  setQuery: (q: string) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
};

const WikiContext = createContext<WikiState | null>(null);

export function WikiProvider({ children, anchor }: PropsWithChildren<{ anchor: string | undefined }>) {
  const { meta, countries } = useDashboardData();
  const wide = useMediaQuery("(min-width: 1024px)", true);

  const [prefs] = useState(readAboutPrefs);
  const [railCollapsed, setRailCollapsed] = useState(prefs.railCollapsed);
  const [narrowOpen, setNarrowOpen] = useState(false);
  const [expanded, setExpandedMap] = useState<Record<string, boolean>>(() => {
    const target = anchor ? resolveAnchor(anchor) : null;
    // A deep link opens its section before first paint so there is nothing to animate.
    return target ? { ...prefs.expanded, [target.section.id]: true } : prefs.expanded;
  });
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    writeAboutPrefs({ railCollapsed, expanded });
  }, [railCollapsed, expanded]);

  const railOpen = wide ? !railCollapsed : narrowOpen;
  const setRailOpen = useCallback(
    (open: boolean) => {
      if (wide) setRailCollapsed(!open);
      else setNarrowOpen(open);
    },
    [wide],
  );

  const setExpanded = useCallback((id: string, open: boolean) => {
    setExpandedMap((prev) => (prev[id] === open ? prev : { ...prev, [id]: open }));
  }, []);
  const expandAll = useCallback(() => {
    setExpandedMap(Object.fromEntries(SECTIONS.map((s) => [s.id, true])));
  }, []);
  const collapseAll = useCallback(() => setExpandedMap({}), []);

  const facts = useMemo<Facts>(
    () => ({
      countries: countries.length ? String(countries.length) : "",
      indicators: meta ? String(meta.indicators.length) : "",
      pillars: meta ? String(meta.pillars.length) : "",
      subdomains: meta ? String(meta.subdomains.length) : "",
      firstYear: meta ? String(meta.years[0]) : "",
      lastYear: meta ? String(meta.years[meta.years.length - 1]) : "",
    }),
    [meta, countries.length],
  );

  const value = useMemo<WikiState>(
    () => ({
      facts,
      wide,
      railOpen,
      setRailOpen,
      expanded,
      isExpanded: (id) => expanded[id] === true,
      setExpanded,
      expandAll,
      collapseAll,
      query,
      setQuery,
      activeId,
      setActiveId,
    }),
    [facts, wide, railOpen, setRailOpen, expanded, setExpanded, expandAll, collapseAll, query, activeId],
  );

  return <WikiContext.Provider value={value}>{children}</WikiContext.Provider>;
}

export function useWiki(): WikiState {
  const ctx = useContext(WikiContext);
  if (!ctx) throw new Error("useWiki must be used inside WikiProvider");
  return ctx;
}
