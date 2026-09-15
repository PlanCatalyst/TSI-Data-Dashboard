import { useDashboardData } from "../../state/dashboard-context";
import type { Indicator, Subdomain } from "../../data/contract/types";
import {
  ABOUT_INTRO,
  SOURCE_NOTE,
  FRAMEWORK_CARDS,
  METHODOLOGY_SECTIONS,
  SOURCE_ATTRIBUTIONS,
  type FrameworkCardGroup,
} from "../../content/about";
import { DEFERRED_INDICATORS } from "../../content/data-notes";
import { UX_UNAVAILABLE_COPY } from "../../data/contract/projections";

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
                {ind.key in DEFERRED_INDICATORS && (
                  <em style={{ color: "var(--mut)", fontSize: 11, marginLeft: 4 }} title={DEFERRED_INDICATORS[ind.key]}>
                    (deferred)
                  </em>
                )}
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

      <h2>Methodology</h2>
      {METHODOLOGY_SECTIONS.map((section) => (
        <section key={section.title} className="about-section">
          <h3>{section.title}</h3>
          {section.paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </section>
      ))}

      <h2>Data sources</h2>
      <p>
        All underlying data is publicly available. Attribution and licence wording below are
        placeholders — final copy will be confirmed with each data provider.
      </p>
      <ul className="source-list">
        {SOURCE_ATTRIBUTIONS.map((src) => (
          <li key={src.name}>
            <strong>{src.name}</strong> — {src.description}
            <span className="source-indicators">Covers: {src.indicators}</span>
          </li>
        ))}
      </ul>

      <h2>Known gaps &amp; missing data</h2>
      <p>
        A <strong>dash (—)</strong> or blank cell anywhere in this tool means the value is{" "}
        <code>null</code> in the published data contract — never coerced to zero. Two distinct
        kinds of blank exist:
      </p>
      <ul style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 20 }}>
        <li>
          <strong>Deferred by design</strong> — some indicators are intentionally absent regardless
          of snapshot freshness, because their methodology is not finalized or their scorer is
          unresolved:
          <ul style={{ marginTop: 4 }}>
            <li>
              <em>Concessionality Index (conces)</em> — {DEFERRED_INDICATORS.conces}
            </li>
            <li>
              <em>Population density (popdens)</em> — {DEFERRED_INDICATORS.popdens}
            </li>
          </ul>
        </li>
        <li>
          <strong>Absent from this snapshot</strong> — some indicators are fully wired in the
          pipeline but the current published payload has no values yet (for example,{" "}
          <em>gii</em>, <em>ndgain</em>, <em>state</em>, or <em>mpi</em> on a local dry-run
          payload). Coverage improves automatically once a fresh snapshot is published — no
          frontend change is needed.
        </li>
      </ul>
      <p style={{ fontSize: 12, color: "var(--mut)", fontStyle: "italic" }}>
        Scoring direction and known gaps are documented in{" "}
        <code>indicators/SCORING_AUDIT.md</code> in the repository.
      </p>

      <h2>Indicator framework</h2>
      <p>
        {meta
          ? `All ${meta.indicators.length} indicators are drawn from the SDG indicator framework and supplementary international databases, organised across ${meta.pillars.length} pillars covering ${meta.years[0]}–${meta.years[meta.years.length - 1]}.`
          : "Indicator framework data is not yet available."}
      </p>

      {meta?.projections.enabled === false ? (
        <p style={{ fontSize: 12, color: "var(--mut)", fontStyle: "italic" }}>
          Note: {meta.projections.note}
        </p>
      ) : meta?.projections.enabled === true ? (
        <p style={{ fontSize: 12, color: "var(--mut)", fontStyle: "italic" }}>
          Forecast intervals (when published) use value_lo/value_hi bands for eligible
          series. Where a forecast is unavailable: {UX_UNAVAILABLE_COPY}
          {meta.projections.firstProjectedYear != null
            ? ` First projected year: ${meta.projections.firstProjectedYear}.`
            : ""}
        </p>
      ) : null}

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
