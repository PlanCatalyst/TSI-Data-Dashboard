# Data audit, 2026-10-15

Independent re-derivation of every published dashboard number from the raw
store, reconciled against `dashboard/public/v1/`. Method: `audit/README.md`.
Scripts `audit/derive_*.py` read only `data/store/20261015T001106Z/` and never
import the pipeline (except the consistency check, which tests the pipeline's
own stages). Scoring mode clamp, tolerance 0.15.

## Result

| | Before fixes | After fixes |
|---|---:|---:|
| Expected rows | 97,070 | 97,038 |
| Match | 97,011 | 97,038 |
| Value mismatch | 0 | 0 |
| Missing in dashboard | 59 (32 an audit scope error) | 0 |
| Extra in dashboard (strict check) | 557 | 15 |
| Unexplained drops, raw to published | 0 | 0 |
| Blocking validation findings | 0 | 0 |

Every number the pipeline computes from a valid input matches the
independent derivation exactly. Every defect was in what got published, not
in how it was scored: values published with no valid source behind them, and
valid values that never reached the dashboard. The 15 rows left are the mspi
partial-input question (DQ-14), which is an open decision.

"Before" uses the strict reconcile check (see Audit tooling below); the first
run reported 102 extras because of a blind spot.

Snapshots: live fetch `20261015T001106Z`; post-fix offline run
`20261015T235428Z` over byte-identical raw files (checked by
`derive_consistency.py`).

## Agreement per indicator (after fixes)

| Indicator | Match | Mismatch | Missing in dashboard | Extra in dashboard | Agreement |
|---|---:|---:|---:|---:|---:|
| `abr` | 3541 | 0 | 0 | 0 | 100.0% |
| `uhc` | 4632 | 0 | 0 | 0 | 100.0% |
| `u5mr` | 4875 | 0 | 0 | 0 | 100.0% |
| `tb` | 5157 | 0 | 0 | 0 | 100.0% |
| `susag` | 20 | 0 | 0 | 0 | 100.0% |
| `stunt` | 4050 | 0 | 0 | 0 | 100.0% |
| `state` | 5168 | 0 | 0 | 0 | 100.0% |
| `sanit` | 3569 | 0 | 0 | 0 | 100.0% |
| `renew` | 7191 | 0 | 0 | 0 | 100.0% |
| `pov` | 1147 | 0 | 0 | 0 | 100.0% |
| `popdens` | 7311 | 0 | 0 | 0 | 100.0% |
| `ndgain` | 5700 | 0 | 0 | 0 | 100.0% |
| `mspi` | 2773 | 0 | 0 | 15 | 100.0% |
| `mpi` | 244 | 0 | 0 | 0 | 100.0% |
| `mmr` | 4656 | 0 | 0 | 0 | 100.0% |
| `maln` | 4075 | 0 | 0 | 0 | 100.0% |
| `mal` | 2675 | 0 | 0 | 0 | 100.0% |
| `ihr` | 1148 | 0 | 0 | 0 | 100.0% |
| `gii` | 4600 | 0 | 0 | 0 | 100.0% |
| `food` | 1280 | 0 | 0 | 0 | 100.0% |
| `finc` | 701 | 0 | 0 | 0 | 100.0% |
| `elec` | 5325 | 0 | 0 | 0 | 100.0% |
| `contra` | 480 | 0 | 0 | 0 | 100.0% |
| `clean` | 4800 | 0 | 0 | 0 | 100.0% |
| `anaem` | 4608 | 0 | 0 | 0 | 100.0% |
| `agoda` | 3413 | 0 | 0 | 0 | 100.0% |
| `washmort` | 183 | 0 | 0 | 0 | 100.0% |
| `water` | 3716 | 0 | 0 | 0 | 100.0% |

Agreement is match over match plus value mismatch. All 28 indicators are
covered.

## Defects found and fixed

| Issue | What was wrong | Published values affected | Fix |
|---|---|---:|---|
| DQ-10 | Agriculture aid with no GDP kept raw USD millions and scored as a ratio, so 100 | 60 extra | null without GDP; R10 blocks values above 1 |
| DQ-11 | Urban-only rows published as national water, sanitation and poverty | 482 extra, 22 countries | series-level total preference; R11 blocks |
| DQ-12 | WGI legacy code ADO dropped Andorra's state capacity series | 26 missing | legacy ISO3 alias map in `country_identity.py` |
| DQ-13 | Survey label `2010-11 D` rejected, Senegal MPI wave lost | 1 missing | pattern accepts hyphenated windows, end year 2011, rejects logged |
| none | Channel Islands popdens expected by the audit, not in the 216-country scope | 32 missing | audit scope filter (`audit/_scope.py`) |
| DQ-14 | mspi debt risk from a partial set of ratios, biased toward Low | 15 extra | decision, see below |

Details and evidence: `docs/data-quality-issues.md`, root-cause files
`audit/findings/rootcause_*.md`.

## Audit tooling corrections

- `reconcile.py` flagged an unexpected published value only when the audit
  had some expected row for that country and indicator. A country the audit
  dropped entirely was never checked, which hid North Korea agoda (25 years
  at 100) and 16 more urban-only water and sanitation countries. It now checks
  every country for every audited indicator.
- The consistency check's copy of the dimension rule now mirrors the
  series-level total rule, and the run-id check accepts a rerun only over
  byte-identical raw files.
- The audit MPI year now expands two-digit end years like the pipeline.

## Unexplained drops

None. Every row lost between raw, cleaned, harmonised, dimension-selected,
scored and published carries a counted reason in
`audit/results/consistency_accounting.csv` (207 accounting rows, 0
unexplained).

## Benchmark and documentation disagreements

From `audit/findings/consistency.md` Check 3. None changes a published
number today; each is either stale text or an unstated constant.

- renew: yaml says a goal of 20% (a level); the factory uses 20 as the allowed
  gap, an 80% renewable benchmark. Every other gap-based indicator quotes the
  gap. Open question 1.
- contra: yaml does not say whether 11.5 is a level or a gap; the factory
  treats it as a gap (88.5% benchmark).
- abr, gii, ndgain, mpi: yaml says values below the "global average" are
  harmonised, but no global average is ever given. Under clamp the result is
  the same only if it equals the threshold.
- susag: yaml still describes the retired 1 to 5 band transform; the factory
  and `SCORING_AUDIT.md` use 100 minus value since 2026-07-07.
- stunt, gii, agoda: wording drift in the yaml (scale, "min group value",
  global average reference).
- ihr: `SCORING_AUDIT.md` says class-code weighted; the pipeline takes an
  unweighted mean of the 13 capacities (the SDG 3.d.1 definition).

## Open questions

1. Renewables benchmark: 20% share goal or 20-point gap (80% share)?
   Answered 2026-10-16: a 20% share goal, scored as relative gain
   (`indicators/SCORING_AUDIT.md`).
2. Agriculture aid share divides constant 2022 USD by current-USD GDP. Accept,
   or deflate GDP?
3. Countries with no GDP (North Korea, Eritrea, South Sudan, Yemen, Cuba,
   Syria recent years) now show no agriculture aid score. Accept, or use
   another GDP source?
4. The contract says overall is null when any pillar is null; 104 of 216
   countries publish an overall from the pillars present. Change the
   contract text or the publisher?
5. mspi with a missing debt ratio (DQ-14): require all three and publish
   null (recommended), or score from what exists and document it?
6. Contraception benchmark: is 11.5 a level or a gap?
   Answered 2026-10-16: neither; the benchmark is the 77.2% global average,
   scored as relative gain (`indicators/SCORING_AUDIT.md`).

## Files

- Derivation: `audit/derive_{sdg_health,sdg_other,worldbank,ndgain_undp,consistency}.py`, `audit/_scope.py`
- Expectations: `audit/expected/*.csv`
- Findings: `audit/findings/*.md`, `audit/findings/*_diag.csv`
- Results: `audit/results/summary.md`, `mismatches.csv`, `consistency_accounting.csv`
