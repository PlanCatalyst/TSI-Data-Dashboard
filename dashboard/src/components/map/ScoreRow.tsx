import type { Pillar } from "../../data/contract/types";
import { trendBucket } from "../../data/contract/selectors";
import {
  confidenceMeta,
  coverageText,
  derivationLabel,
  type PillarScoreContext,
} from "../../data/contract/score-context";
import { NeedBadge } from "../scores/ScoreWithContext";
import { seriesColor } from "../scores/series-color";

type Props = {
  pillar: Pillar;
  ctx: PillarScoreContext;
  // Change over the observed window, used for the trend line in the detail.
  delta: number | null;
  firstYear: number | null;
  expanded: boolean;
  onToggle: () => void;
};

export function TrendLabel({ delta, since }: { delta: number | null; since: number | null }) {
  const bucket = trendBucket(delta);
  const sinceText = since != null ? ` since ${since}` : "";
  if (bucket === "up") return <span className="trend trend--up">{"↑"} Improving{sinceText}</span>;
  if (bucket === "down") return <span className="trend trend--down">{"↓"} Declining{sinceText}</span>;
  if (bucket === "flat") return <span className="trend trend--flat">{"→"} Stable{sinceText}</span>;
  return <span className="trend trend--unknown">Not enough data</span>;
}

// One pillar per row: stripe, name, score, need band. Everything else lives
// in the detail block and shows on expand (REQ2.1, REQ2.2).
export function ScoreRow({ pillar, ctx, delta, firstYear, expanded, onToggle }: Props) {
  const detailId = `score-detail-${pillar.key}`;
  const incomplete = ctx.confidence === "low" && ctx.coverage;
  return (
    <>
      <button
        type="button"
        className="score-row"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <i className="stripe" style={{ background: seriesColor(pillar.key) }} aria-hidden="true" />
        <span className="name">
          {pillar.label}
          {incomplete && (
            <span className="badge badge--incomplete" title="Few indicators back this score">
              {ctx.coverage!.indicatorsWithData} of {ctx.coverage!.indicatorsTotal}
            </span>
          )}
        </span>
        <span className="num">{ctx.value != null ? `${ctx.estimated ? "~" : ""}${ctx.value}` : "—"}</span>
        {ctx.band ? <NeedBadge band={ctx.band} /> : <span className="small">No data</span>}
      </button>
      {expanded && (
        <div className="score-detail" id={detailId}>
          <dl>
            <dt>Coverage</dt>
            <dd>{ctx.coverage ? coverageText(ctx.coverage) : "No indicators with data"}</dd>
            <dt>Latest</dt>
            <dd>{ctx.coverage?.year != null ? ctx.coverage.year : ctx.coverage ? "All years" : "—"}</dd>
            <dt>Trend</dt>
            <dd><TrendLabel delta={delta} since={firstYear} /></dd>
            {ctx.source && (
              <>
                <dt>Derived</dt>
                <dd>
                  {derivationLabel(ctx.source)}
                  {ctx.estimated ? ", estimated from available indicators" : ", published value"}
                </dd>
              </>
            )}
            {ctx.confidence && (
              <>
                <dt>Confidence</dt>
                <dd style={{ color: confidenceMeta(ctx.confidence).color }}>{confidenceMeta(ctx.confidence).label}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </>
  );
}
