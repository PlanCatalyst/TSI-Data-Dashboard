import type { ReactNode } from "react";

import type { NeedBand } from "../../data/contract/score-context";
import { NeedBadge } from "../scores/ScoreWithContext";

type Props = {
  eyebrow: ReactNode;
  title: string;
  overall: { value: number | null; band: NeedBand | null; estimated: boolean };
  expanded: boolean;
  onToggleExpand?: () => void;
  onClose?: () => void;
};

// White panel header: eyebrow (region), country name, overall score and need
// band, then the panel chrome. Mirrors .panel-head in the design system.
export function PanelHead({ eyebrow, title, overall, expanded, onToggleExpand, onClose }: Props) {
  return (
    <div className="panel-head">
      <div className="panel-title">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="h1">{title}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
          <span
            className="num-lg"
            title={overall.estimated ? "No published overall score. Mean of available pillar scores." : undefined}
          >
            {overall.value != null ? `${overall.estimated ? "~" : ""}${overall.value}` : "—"}
          </span>
          <NeedBadge band={overall.band} />
          {overall.estimated && <span className="badge badge--incomplete">Partial</span>}
        </div>
      </div>
      <div className="actions">
        {onToggleExpand && (
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--sm"
            onClick={onToggleExpand}
            aria-label={expanded ? "Collapse detail panel" : "Expand detail panel"}
            aria-pressed={expanded}
            title={expanded ? "Collapse panel" : "Expand panel"}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              {expanded ? (
                <path d="M6 3 11 8 6 13" />
              ) : (
                <path d="M10 3 5 8l5 5" />
              )}
            </svg>
          </button>
        )}
        {onClose && (
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--sm"
            onClick={onClose}
            aria-label="Close country detail"
            title="Close"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
