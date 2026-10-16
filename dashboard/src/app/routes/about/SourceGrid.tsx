import { Link } from "react-router-dom";

import { SOURCES } from "../../../content/about/sources";
import { useReveal } from "../../../hooks/useReveal";
import { useSourceYears } from "./useSourceYears";

/**
 * The first thing on the page: every data source as a large cell with its
 * name, what the dashboard takes from it and why (REQ9.16). Years covered are
 * read from the loaded data.
 */
export function SourceGrid() {
  const years = useSourceYears();
  const ref = useReveal<HTMLElement>("about-sources");
  return (
    <section ref={ref} className="wiki-sources" aria-labelledby="wiki-sources-h">
      <div className="wiki-sources-head" data-reveal="0">
        <span className="eyebrow">About this dashboard</span>
        <h2 id="wiki-sources-h">Where the numbers come from</h2>
        <p>
          Every score is built from one of these {SOURCES.length} public sources. We never estimate a number for a country
          that has no data. The sections below explain how we make the numbers.
        </p>
      </div>
      <ul className="wiki-source-grid">
        {SOURCES.map((s, i) => {
          const y = years[s.id];
          return (
            <li key={s.id} className="wiki-source-cell" data-reveal={i + 1}>
              <span className="eyebrow">{s.provider}</span>
              <h3>{s.name}</h3>
              <dl>
                <div>
                  <dt>What we get</dt>
                  <dd>{s.gets}</dd>
                </div>
                <div>
                  <dt>Why</dt>
                  <dd>{s.why}</dd>
                </div>
              </dl>
              <p className="wiki-source-meta small">
                <span className="num">
                  {s.indicators.length} indicator{s.indicators.length === 1 ? "" : "s"}
                </span>
                {y?.first && y?.last ? (
                  <span className="num">
                    {y.first} to {y.last}
                  </span>
                ) : null}
              </p>
              <p className="wiki-source-links small">
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  Source website
                  <span className="wiki-sr"> (opens in a new tab)</span>
                </a>
                <Link to="/about/sources" className="wiki-xref">
                  Coverage and refresh
                </Link>
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
