import {
  coverageText,
  derivationLabel,
  type Coverage,
  type NeedBand,
  type ScoreSource,
} from "../../data/contract/score-context";

// Shared score-context atoms so need, derivation and coverage render
// identically on Map, Explore and Compare. Styling lives in components.css
// (.chip, .badge, .small) and comes from the design system.

// `size` is accepted for backwards compatibility with Explore and Compare
// and is removed in Pass B5; the chip has one size.
export function NeedBadge({ band }: { band: NeedBand | null; size?: number }) {
  if (!band) return null;
  return <span className={`chip chip--${band.key}`}>{band.label}</span>;
}

export function DerivationBadge({ source }: { source: ScoreSource | null }) {
  if (!source) return null;
  const cls = source === "latest" ? "badge badge--scored" : "badge badge--incomplete";
  return <span className={cls}>{derivationLabel(source)}</span>;
}

export function CoverageNote({ coverage }: { coverage: Coverage | null }) {
  if (!coverage) return null;
  return <span className="small">{coverageText(coverage)}</span>;
}

type ScoreWithContextProps = {
  value: number | null;
  band: NeedBand | null;
  source?: ScoreSource | null;
  coverage?: Coverage | null;
  // Prefix the number with ~ to signal a client-side estimate.
  estimated?: boolean;
  valueColor?: string;
  valueSize?: number;
  align?: "center" | "left";
  // Title text shown on hover (e.g. "official pillar score unavailable").
  title?: string;
};

// Headline score plus its interpretive context, stacked vertically. Used by
// the Compare country cards.
export function ScoreWithContext({
  value,
  band,
  source = null,
  coverage = null,
  estimated = false,
  valueColor,
  valueSize,
  align = "center",
  title,
}: ScoreWithContextProps) {
  const items = align === "center" ? "center" : "flex-start";
  return (
    <div
      title={title}
      style={{ display: "flex", flexDirection: "column", alignItems: items, gap: "var(--sp-1)", textAlign: align }}
    >
      <div className={valueSize && valueSize >= 24 ? "num-lg" : "num"} style={{ color: valueColor }}>
        {value != null ? `${estimated ? "~" : ""}${value}` : "—"}
      </div>
      {value != null && (
        <>
          <NeedBadge band={band} />
          {source && <DerivationBadge source={source} />}
          <CoverageNote coverage={coverage} />
        </>
      )}
    </div>
  );
}
