"""Run every data quality rule against the scored outputs and write a report.

    python -m src.validation            # against data/interim/validated/

Blocks (exit 1, DataQualityError) when any "block" finding exists. The
orchestrator runs this as the "data validation" stage between score and
publish, so a sawtooth series or a conflicting disaggregation can never
reach the dashboard.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from src.validation.rules import RULES, Finding, Inputs

REPORT_JSON = "data_quality_report.json"
REPORT_MD = "data_quality_report.md"

# Series whose source is genuinely lumpy year to year (aid disbursements),
# where a sawtooth is real and reported as a warning instead of a block.
LUMPY_SERIES = ("DC_TOF_AGRL",)


class DataQualityError(RuntimeError):
    pass


def _load(validated_dir: Path) -> Inputs:
    scored = pd.read_csv(validated_dir / "Indicator_Scores_Full.csv", low_memory=False)
    pillars_p = validated_dir / "pillarscores.csv"
    subs_p = validated_dir / "subdomainscores.csv"
    pillars = pd.read_csv(pillars_p) if pillars_p.exists() else pd.DataFrame()
    subs = pd.read_csv(subs_p) if subs_p.exists() else pd.DataFrame()
    return Inputs(scored=scored, pillars=pillars, subdomains=subs, options={"lumpy_series": LUMPY_SERIES})


def evaluate(inputs: Inputs) -> list[Finding]:
    findings: list[Finding] = []
    for rule in RULES:
        findings.extend(rule(inputs))
    return findings


def write_report(findings: list[Finding], validated_dir: Path) -> tuple[int, int]:
    blocks = [f for f in findings if f.severity == "block"]
    warns = [f for f in findings if f.severity == "warn"]
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    (validated_dir / REPORT_JSON).write_text(json.dumps(
        {"generated": stamp, "blocks": len(blocks), "warnings": len(warns), "findings": [f.as_dict() for f in findings]},
        indent=2))
    lines = [f"# Data quality report", "", f"Generated {stamp}. Rules: `src/validation/rules.py`. Issue log: `docs/data-quality-issues.md`.", "",
             f"**{len(blocks)} blocking**, {len(warns)} warnings.", ""]
    by_rule: dict[str, list[Finding]] = {}
    for f in findings:
        by_rule.setdefault(f.rule, []).append(f)
    for rule in sorted(by_rule):
        fs = by_rule[rule]
        lines.append(f"## {rule} ({fs[0].issue}, {fs[0].severity}, {len(fs)} findings)")
        lines.append("")
        lines.append("| Series | Country | Detail |")
        lines.append("|---|---|---|")
        for f in fs[:40]:
            lines.append(f"| {f.series or ''} | {f.country or ''} | {f.detail} |")
        if len(fs) > 40:
            lines.append(f"| | | and {len(fs) - 40} more |")
        lines.append("")
    (validated_dir / REPORT_MD).write_text("\n".join(lines))
    return len(blocks), len(warns)


def run_validation(validated_dir: Path, log=print) -> list[Finding]:
    inputs = _load(Path(validated_dir))
    findings = evaluate(inputs)
    blocks, warns = write_report(findings, Path(validated_dir))
    summary: dict[str, int] = {}
    for f in findings:
        summary[f"{f.rule}/{f.severity}"] = summary.get(f"{f.rule}/{f.severity}", 0) + 1
    log(f"data validation: {blocks} blocking, {warns} warnings "
        f"({', '.join(f'{k}={v}' for k, v in sorted(summary.items())) or 'clean'}); report {REPORT_MD}")
    if blocks:
        head = "; ".join(f"{f.rule} {f.series or ''} {f.country or ''}: {f.detail}" for f in findings if f.severity == "block")[:600]
        raise DataQualityError(f"{blocks} blocking findings: {head}")
    return findings


def main() -> int:
    from src.pipeline.utils import project_root
    validated = project_root() / "data" / "interim" / "validated"
    try:
        run_validation(validated)
    except DataQualityError as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
