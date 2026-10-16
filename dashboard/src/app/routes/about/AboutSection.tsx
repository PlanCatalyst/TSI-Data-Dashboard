import { Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { sectionStatus, type SectionContent } from "../../../content/about";
import { useSectionReveal } from "../../../hooks/useSectionReveal";
import { Disclosure } from "../../../components/controls/Disclosure";
import { StatusChip } from "./StatusChip";
import { Rich } from "./rich";
import { useWiki } from "./WikiContext";
import { VISUALS } from "./visuals";

/** Scrolls to the contents rail and moves focus to its toggle. */
export function goToContents(open: () => void) {
  open();
  requestAnimationFrame(() => {
    const rail = document.getElementById("wiki-contents");
    rail?.scrollIntoView({ block: "start", behavior: "auto" });
    document.getElementById("wiki-rail-toggle")?.focus({ preventScroll: true });
  });
}

/**
 * One section, always the same parts in the same order (REQ9.4): short answer,
 * visual, the detail, a link to the dashboard, and a provenance line. The
 * visual mounts when the reader scrolls near it; the detail mounts when opened.
 */
export function AboutSection({ s }: { s: SectionContent }) {
  const { facts, isExpanded, setExpanded, setRailOpen } = useWiki();
  const reveal = useSectionReveal<HTMLElement>();
  const holder = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(typeof IntersectionObserver === "undefined");

  useEffect(() => {
    if (near || !holder.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(holder.current);
    return () => io.disconnect();
  }, [near]);

  const status = sectionStatus(s.provenance.decisionIds);
  const visual = VISUALS[s.id];

  return (
    <section
      id={s.id}
      ref={reveal}
      className="wiki-sec"
      data-wiki-section={s.id}
      aria-labelledby={`${s.id}-h`}
    >
      <header className="wiki-sec-head" data-sec-reveal="0">
        <div>
          <span className="eyebrow num">{s.number}</span>
          <h2 id={`${s.id}-h`} tabIndex={-1}>
            {s.title}
          </h2>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm wiki-contents-btn"
          onClick={() => goToContents(() => setRailOpen(true))}
        >
          Contents
        </button>
      </header>

      <div className="wiki-answer" data-sec-reveal="1">
        {s.answer.map((p, i) => (
          <p key={i}>
            <Rich text={p} facts={facts} />
          </p>
        ))}
      </div>

      {visual ? (
        <div ref={holder} className="wiki-visual" data-sec-reveal="2" style={{ minHeight: near ? undefined : visual.minHeight }}>
          {near ? (
            <Suspense
              fallback={
                <div className="wiki-visual-loading small" role="status" style={{ minHeight: visual.minHeight }}>
                  Loading
                </div>
              }
            >
              <visual.Component />
            </Suspense>
          ) : null}
        </div>
      ) : null}

      <div data-sec-reveal="3">
        <Disclosure className="disc--lg" title="The detail" open={isExpanded(s.id)} onToggle={(o) => setExpanded(s.id, o)}>
          <div className="wiki-detail">
            {s.detail.map((b) => (
              <div key={b.id} id={b.id} className="wiki-block" tabIndex={-1}>
                <h4>{b.heading}</h4>
                {b.body.map((p, i) => (
                  <p key={i}>
                    <Rich text={p} facts={facts} />
                  </p>
                ))}
              </div>
            ))}
          </div>
        </Disclosure>
      </div>

      <footer className="wiki-prov" data-sec-reveal="4">
        {s.dashboardLink ? (
          <Link to={s.dashboardLink.to} className="wiki-seelink">
            See it on the dashboard: {s.dashboardLink.label}
          </Link>
        ) : null}
        <span className="small">Checked {s.provenance.updated}</span>
        {status ? <StatusChip status={status} /> : null}
        <button type="button" className="wiki-backlink" onClick={() => goToContents(() => setRailOpen(true))}>
          Back to contents
        </button>
      </footer>
    </section>
  );
}
