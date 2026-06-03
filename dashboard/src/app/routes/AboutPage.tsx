import { useDashboardData } from "../../state/dashboard-context";
import type { Indicator, Subdomain } from "../../data/contract/types";
import { ABOUT_INTRO, SOURCE_NOTE, FRAMEWORK_CARDS, type FrameworkCardGroup } from "../../content/about";

// ── Framework card (one card may span multiple pillars) ───────────────────────

type FrameworkCardProps = {
  group: FrameworkCardGroup;
  subdomains: Subdomain[];
  indicators: Indicator[];
};

function FrameworkCard({ group, subdomains, indicators }: FrameworkCardProps) {
  const groupSubdomains = subdomains.filter(sd => group.pillars.includes(sd.pillar));
  const groupIndicators = indicators.filter(ind => group.pillars.includes(ind.pillar));

  return (
    <div className="fw-card">
      <div className="fw-head" style={{ background: group.color }}>
        {group.title}
      </div>
      {groupSubdomains.map(sd => {
        const sdIndicators = groupIndicators.filter(ind => ind.subdomain === sd.key);
        return (
          <div key={sd.key}>
            <div className="fw-item" style={{ fontWeight: 700 }}>
              {sd.label}
            </div>
            {sdIndicators.map(ind => (
              <div key={ind.key} className="fw-item">
                {ind.sdg !== "—" && `${ind.sdg} · `}{ind.label}
                <span>{ind.unit} · {ind.source}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AboutPage() {
  const { meta } = useDashboardData();

  return (
    <div className="about-body">
      <h2>About this tool</h2>
      {ABOUT_INTRO.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}

      <h2>Indicator framework</h2>
      <p>
        {meta
          ? `All ${meta.indicators.length} indicators are drawn from the SDG indicator framework and supplementary international databases, organised across ${meta.pillars.length} pillars covering ${meta.years[0]}–${meta.years[meta.years.length - 1]}.`
          : "Indicator framework data is not yet available."}
      </p>

      {meta?.projections.enabled === false && (
        <p style={{ fontSize: 12, color: "var(--mut)", fontStyle: "italic" }}>
          Note: {meta.projections.note}
        </p>
      )}

      {meta && (
        <>
          <div className="fw-grid">
            {FRAMEWORK_CARDS.map(group => (
              <FrameworkCard
                key={group.title}
                group={group}
                subdomains={meta.subdomains}
                indicators={meta.indicators}
              />
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--mut)" }}>{SOURCE_NOTE}</p>
        </>
      )}
    </div>
  );
}
