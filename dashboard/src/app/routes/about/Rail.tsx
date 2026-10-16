import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";

import { GLOSSARY, SECTIONS } from "../../../content/about";
import { plainText } from "./rich";
import { useWiki } from "./WikiContext";

/**
 * Contents rail (REQ9.1, REQ9.5). It lists every section and, for the one in
 * view, its subsections. A toggle collapses it to a slim strip on wide screens
 * and to an "On this page" disclosure below 1024 px. Nothing relies on it
 * staying in view: sticky positioning is an enhancement in the stylesheet.
 */
export function Rail() {
  const { railOpen, setRailOpen, wide, expandAll, collapseAll, query, setQuery, activeId, facts } = useWiki();
  const location = useLocation();
  const q = query.trim().toLowerCase();

  const sections = useMemo(
    () =>
      SECTIONS.filter((s) => {
        if (!q) return true;
        const hay = [s.title, ...s.keywords, ...s.detail.map((d) => d.heading), ...s.answer.map((a) => plainText(a, facts))]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      }),
    [q, facts],
  );
  const terms = useMemo(
    () => (q ? GLOSSARY.filter((g) => `${g.term} ${g.definition}`.toLowerCase().includes(q)) : []),
    [q],
  );

  const toggleLabel = wide ? "Contents" : "On this page";

  return (
    <aside id="wiki-contents" className="wiki-rail" data-open={railOpen} aria-label="About page contents">
      <div className="wiki-rail-inner">
        <button
          id="wiki-rail-toggle"
          type="button"
          className="wiki-rail-toggle"
          aria-expanded={railOpen}
          aria-controls="wiki-rail-body"
          aria-label={railOpen ? `Hide ${toggleLabel.toLowerCase()}` : `Show ${toggleLabel.toLowerCase()}`}
          onClick={() => setRailOpen(!railOpen)}
        >
          <span className="wiki-rail-toggle-label">{toggleLabel}</span>
          <span className="wiki-rail-chevron" aria-hidden="true" />
        </button>

        <div id="wiki-rail-body" className="wiki-rail-body">
          <label className="wiki-filter">
            <span className="wiki-sr">Filter sections and glossary terms</span>
            <input
              type="search"
              placeholder="Filter sections and terms"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="wiki-rail-actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={expandAll}>
              Expand all
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={collapseAll}>
              Collapse all
            </button>
          </div>

          <nav aria-label="Sections">
            <ol className="wiki-toc">
              {sections.map((s) => {
                const active = activeId === s.id;
                return (
                  <li key={s.id} data-active={active}>
                    <Link
                      to={`/about/${s.id}`}
                      state={{ at: location.key }}
                      aria-current={active ? "location" : undefined}
                    >
                      <span className="num wiki-toc-n">{s.number}</span>
                      {s.title}
                    </Link>
                    {active ? (
                      <ul className="wiki-toc-sub">
                        {s.detail.map((d) => (
                          <li key={d.id}>
                            <Link to={`/about/${d.id}`} state={{ at: location.key }}>
                              {d.heading}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            {sections.length === 0 && terms.length === 0 ? <p className="small">Nothing matches &ldquo;{query}&rdquo;.</p> : null}
          </nav>

          {terms.length ? (
            <div className="wiki-toc-terms">
              <span className="eyebrow">Glossary terms</span>
              <ul>
                {terms.map((g) => (
                  <li key={g.id}>
                    <Link to="/about/glossary" state={{ at: location.key }}>
                      {g.term}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
