import type { CSSProperties } from "react";

import {
  coverageText,
  derivationLabel,
  type Coverage,
  type NeedBand,
  type ScoreSource,
} from "../../data/contract/score-context";

// Small, shared score-context atoms so need / derivation / coverage labels
// render identically on Map, Explore, and Compare and never drift.

const PILL: CSSProperties = {
  display: "inline-block",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: ".4px",
  textTransform: "uppercase",
  lineHeight: 1.4,
  padding: "1px 5px",
  borderRadius: 4,
  whiteSpace: "nowrap",
};

export function NeedBadge({ band, size = 9.5 }: { band: NeedBand | null; size?: number }) {
  if (!band) return null;
  return (
    <span
      style={{
        fontSize: size,
        fontWeight: 700,
        letterSpacing: ".4px",
        textTransform: "uppercase",
        color: band.color,
        whiteSpace: "nowrap",
      }}
    >
      {band.label}
    </span>
  );
}

export function DerivationBadge({ source }: { source: ScoreSource | null }) {
  if (!source) return null;
  return (
    <span style={{ ...PILL, color: "var(--mut)", background: "#eef0f3" }}>
      {derivationLabel(source)}
    </span>
  );
}

export function CoverageNote({ coverage }: { coverage: Coverage | null }) {
  if (!coverage) return null;
  return (
    <span style={{ fontSize: 9.5, color: "var(--mut)", whiteSpace: "nowrap" }}>
      {coverageText(coverage)}
    </span>
  );
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

// Headline score plus its interpretive context, stacked vertically. Used for the
// Map pillar grid and the Compare country cards.
export function ScoreWithContext({
  value,
  band,
  source = null,
  coverage = null,
  estimated = false,
  valueColor,
  valueSize = 17,
  align = "center",
  title,
}: ScoreWithContextProps) {
  const items = align === "center" ? "center" : "flex-start";
  return (
    <div
      title={title}
      style={{ display: "flex", flexDirection: "column", alignItems: items, gap: 2, textAlign: align }}
    >
      <div style={{ color: valueColor, fontSize: valueSize, fontWeight: 700, lineHeight: 1.1 }}>
        {value != null ? `${estimated ? "~" : ""}${value}` : "—"}
      </div>
      {value != null && (
        <>
          <NeedBadge band={band} />
          {source && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start" }}>
              <DerivationBadge source={source} />
            </div>
          )}
          <CoverageNote coverage={coverage} />
        </>
      )}
    </div>
  );
}
