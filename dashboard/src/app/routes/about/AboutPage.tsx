import { useEffect } from "react";
import { useLocation, useParams } from "react-router-dom";

import { SECTIONS, resolveAnchor } from "../../../content/about";
import { prefersReducedMotion } from "../../../hooks/useMediaQuery";
import { AboutSection } from "./AboutSection";
import { Rail } from "./Rail";
import { SourceGrid } from "./SourceGrid";
import { WikiProvider, useWiki } from "./WikiContext";

/** Marks the section nearest the top of the viewport as the one in view. */
function useScrollSpy(setActive: (id: string | null) => void) {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.wikiSection;
          if (!id) continue;
          if (e.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const first = SECTIONS.find((s) => visible.has(s.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    document.querySelectorAll("[data-wiki-section]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [setActive]);
}

/**
 * Opens and scrolls to the section or subsection named by the route
 * (REQ9.2). A cold load already has the section open, so it scrolls at once;
 * from within the page it waits for the detail to finish opening.
 */
function useDeepLink(anchor: string | undefined, locationKey: string) {
  const { isExpanded, setExpanded } = useWiki();
  useEffect(() => {
    if (!anchor) return;
    const target = resolveAnchor(anchor);
    if (!target) return;
    const wasOpen = isExpanded(target.section.id);
    if (!wasOpen) setExpanded(target.section.id, true);
    const wait = target.blockId && !wasOpen && !prefersReducedMotion() ? 700 : 60;
    const t = window.setTimeout(() => {
      const el = document.getElementById(target.blockId ?? target.section.id);
      if (!el) return;
      el.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
      const heading = target.blockId ? el : document.getElementById(`${target.section.id}-h`);
      heading?.focus({ preventScroll: true });
    }, wait);
    return () => window.clearTimeout(t);
    // Re-run on every navigation to an anchor, including the same one twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, locationKey]);
}

function AboutInner({ anchor }: { anchor: string | undefined }) {
  const { railOpen, setActiveId } = useWiki();
  const location = useLocation();
  useScrollSpy(setActiveId);
  useDeepLink(anchor, location.key);

  return (
    <div className="wiki-page">
      <SourceGrid />
      <div className="wiki" data-rail={railOpen}>
        <Rail />
        <div className="wiki-main">
          {SECTIONS.map((s) => (
            <AboutSection key={s.id} s={s} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AboutPage() {
  const { section } = useParams<{ section?: string }>();
  return (
    <WikiProvider anchor={section}>
      <AboutInner anchor={section} />
    </WikiProvider>
  );
}
