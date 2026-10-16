import { useState } from "react";

import { seriesColor } from "../../../../components/scores/series-color";
import { useDashboardData } from "../../../../state/dashboard-context";
import { LABEL_OVERRIDES } from "../../../../content/about/methodology";
import { ShowAsTable } from "../ShowAsTable";

/**
 * Pillars, subdomains and indicators as a tree. Click a pillar to open its
 * subdomains, click a subdomain to list its indicators. Built from meta.json,
 * so it always matches the published framework.
 */
export function FrameworkTree() {
  const { meta } = useDashboardData();
  const [openPillars, setOpenPillars] = useState<Set<string>>(new Set());
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set());
  if (!meta) return null;

  const toggle = (set: Set<string>, key: string, apply: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    apply(next);
  };

  const rows = meta.pillars.flatMap((p) =>
    meta.subdomains
      .filter((s) => s.pillar === p.key)
      .map((s) => [
        p.label,
        s.label,
        meta.indicators.filter((i) => i.subdomain === s.key).length,
      ] as Array<string | number>),
  );

  return (
    <div className="wiki-viz">
      <ul className="wiki-tree" role="tree" aria-label="Pillars, subdomains and indicators">
        {meta.pillars.map((p) => {
          const subs = meta.subdomains.filter((s) => s.pillar === p.key);
          const total = meta.indicators.filter((i) => i.pillar === p.key).length;
          const open = openPillars.has(p.key);
          return (
            <li key={p.key} role="treeitem" aria-expanded={open} className="wiki-tree-pillar">
              <button
                type="button"
                className="wiki-tree-btn"
                aria-expanded={open}
                onClick={() => toggle(openPillars, p.key, setOpenPillars)}
              >
                <span className="wiki-tree-stripe" style={{ background: seriesColor(p.key) }} aria-hidden="true" />
                <span className="wiki-tree-name">{p.label}</span>
                <span className="small">
                  {subs.length} subdomains, {total} indicators
                </span>
                <span className="wdisc-icon" aria-hidden="true" data-open={open} />
              </button>
              {open ? (
                <ul role="group" className="wiki-tree-sub">
                  {subs.map((s) => {
                    const inds = meta.indicators.filter((i) => i.subdomain === s.key);
                    const subOpen = openSubs.has(s.key);
                    return (
                      <li key={s.key} role="treeitem" aria-expanded={subOpen}>
                        <button
                          type="button"
                          className="wiki-tree-btn wiki-tree-btn--sub"
                          aria-expanded={subOpen}
                          onClick={() => toggle(openSubs, s.key, setOpenSubs)}
                        >
                          <span className="wiki-tree-name">{s.label}</span>
                          <span className="small">{inds.length} indicator{inds.length === 1 ? "" : "s"}</span>
                          <span className="wdisc-icon" aria-hidden="true" data-open={subOpen} />
                        </button>
                        {subOpen ? (
                          <ul role="group" className="wiki-tree-ind">
                            {inds.map((i) => (
                              <li key={i.key} role="treeitem">
                                {i.sdg && /^\d/.test(i.sdg) ? <span className="badge">SDG {i.sdg}</span> : null}
                                <span>{LABEL_OVERRIDES[i.key] ?? i.label}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      <ShowAsTable caption="Subdomains and indicator counts by pillar" columns={["Pillar", "Subdomain", "Indicators"]} rows={rows} />
    </div>
  );
}
