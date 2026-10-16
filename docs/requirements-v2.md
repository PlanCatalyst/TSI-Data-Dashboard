# Requirements: Delivery v2 (post-review, 2026-10-14)

**Status:** draft for client sign-off. §7 design and motion system **approved by Thomas 2026-10-14**.
**Source:** review call with the reviewer (PlanCatalyst), 2026-10-14, plus repo verification the same day
**Owner:** Thomas
**Sign-off:** the reviewer is the final authority on scoring and scope decisions
**Design system reference:** https://claude.ai/artifact/8uYYAMdRPDARvscBYUM47Z (source: `docs/design-system/index.html`)

The v2 delivery is two passes that ship together: a **data validation and
faithfulness pass** (§1, §1.6) and a **UI/UX pass** (§2, §7). The ops work
(§3, §4) follows and is documented against the result.

This document captures every ask from the 2026-10-14 review, what the repo
actually does today, and the acceptance criteria for the next delivery. It is
the single source for the v2 work; `TASKS.md` tracks execution against it.

Contract hierarchy still applies. Anything here that touches payload semantics
is subordinate to `docs/data-contract.md` and needs that file updated first.

---

## 0. Summary of the review

the reviewer's feedback in one line: the data plumbing works, but the dashboard needs
to **look right to a domain reader** and needs to be **operable by a
non-engineer every six months**.

| # | Ask | Type | Verdict after verification |
|---|-----|------|----------------------------|
| R1 | Brazil climate adaptation shows a flat 100 across the whole time span; is the data right? | Data faithfulness | Data is correct. The scoring rule pins every country better than the global benchmark to a flat 100. See §1. |
| R2 | Side panel is too crowded when you click a country | UX | Confirmed from screenshots. See §2. |
| R3 | A playbook document the team can follow every six months, written for non-engineers | Documentation | Does not exist. The runbook is engineer-facing. See §4. |
| R4 | Refresh the data themselves from Azure, without a laptop or a terminal | Operations | Does not exist. Publishing is a manual Python run. See §3. |
| R5 | Account housekeeping: contact Thomas on Gmail, retire the PlanCatalyst account later | Admin | Noted. No engineering work. See §5. |
| R6 | (Thomas) Make the UI modern, intuitive and smooth; the original spec was a single clogged HTML mock | UX / design system | Confirmed drift in the codebase. See §7. |
| R7 | (Thomas) Fix the side panel bugs, e.g. close leaves the map shrunk | Bug | Reproduced in code. See §7.2. |
| R8 | (Thomas) Design system and motion system from PlanCatalyst's brand: square corners, white, blue and green, fade reveals, restrained motion | Design system | Brand extracted from plancatalyst.org. See §7.3 to §7.5. |
| R9 | (Thomas) A comprehensive, interactive About page that explains the methodology, every material decision and every visible oddity | Content / UX | Current page is thin and partly wrong. See §9. |

---

## 1. Data faithfulness: benchmark clamping

### 1.1 What the reviewer saw

Brazil, climate adaptation pillar, score 100 "low need", flat from the first
year to the last. The US shows the same flat 100. Several other pillars show
long flat segments at 100 or 0.

### 1.2 Root cause (verified)

The climate pillar is a single indicator, ND-GAIN composite vulnerability,
scored by `RatioThresholdScorer(threshold=0.46)` in `src/calculating/factory.py`.
The formula is `need = 1 - threshold / value`, clamped to `[0, 100]`.

Brazil's vulnerability runs between 0.37 and 0.41 for every year from 1995 to
2023. Every value is below 0.46, so the formula yields a negative number, the
clamp floors it at 0 need, and the publish boundary flips that to 100 on the
frontend. The trend is real (Brazil improves slowly over the period) but the
rule discards it.

Scale of the effect in the latest two ND-GAIN years:

| Metric | Value |
|--------|-------|
| Country-years with data | 374 |
| Below the 0.46 benchmark (pinned to 100) | 236 |
| Share of countries with no visible variation | 63% |

The same clamp applies to every indicator scored with `RatioThresholdScorer`
or `InverseRatioScorer`, which is most of the SDG health, agriculture and
social-infrastructure indicators plus the Gender Inequality Index and MPI. Any
country better than the client-supplied benchmark is pinned. This is the
client's original scoring framework applied faithfully; it is not a pipeline
bug.

### 1.3 Why it matters

The dashboard's job is to surface *relative* need. A rule that assigns the
same score to the better half of the world hides exactly the gradient a
reader uses to compare, say, Brazil with Chile. Flat lines also read as
"broken" to a domain expert, which undermines trust in the pillars that are
working.

### 1.4 Decision required (the reviewer)

Pick one. Recommendation is option B.

| Option | Rule | Effect | Cost |
|--------|------|--------|------|
| A. Keep as is | Benchmark clamp stays | No change; document the behaviour in the UI | Trust problem remains |
| **B. Soft floor (recommended)** | Keep the benchmark as the midpoint but let values below it map onto a lower band instead of 0, e.g. linear from the observed best value to the benchmark into `[0, 25]` need | Preserves "better than benchmark" semantics, restores variation and trends | Scoring audit update, index_version bump, re-publish |
| C. Full min-max | Drop benchmarks, normalise each indicator across the observed country range per year | Maximum variation | Loses the client's benchmark framing entirely; cross-year comparability needs care |

### 1.5 Acceptance criteria

- AC1.1 No country shows an identical pillar score for more than 10
  consecutive years unless the underlying source values are identical.
- AC1.2 `indicators/SCORING_AUDIT.md` documents the chosen rule per scorer
  class, with before/after examples for Brazil (climate) and one SDG indicator.
- AC1.3 `index_version` in `meta.json` bumps and `docs/data-contract.md`
  records the change before the publisher changes.
- AC1.4 A pytest covers the new scorer branch for a value below the benchmark.
- AC1.5 The data notes in the frontend explain the benchmark rule in one
  sentence where a score is shown.

### 1.6 Related observations from the screenshots (verify, then triage)

- Brazil agriculture shows 0.7 "severe need" from 1 of 3 indicators, with a
  series that jumps from about 50 to 0 and back. Single-indicator pillars
  swing on one source's coverage. Consider a minimum-coverage rule before a
  pillar score is shown, or a visible "1 of 3 indicators" warning band.
- Regional averages ramp to 100 around 1995 to 2001 then drop sharply in the
  final year. Likely the "partial coverage may inflate sparse years" effect
  already noted in the map legend. Confirm, then either suppress regional
  averages for years under a coverage threshold or shade them.
- "Projection band coming soon" is still visible. Either ship projections or
  remove the placeholder before handoff.

### 1.7 Data validation module (added 2026-10-14, Thomas)

Thomas's review of the rebuilt UI on the published snapshot found that the
zigzags the reviewer described were not one defect but three, and that the fix has
to be structural: every defect gets a log entry, a rule that catches it in
data, and a stage that blocks publish on it.

- REQ1.1 `docs/data-quality-issues.md` is the issue log. A dashboard defect is
  logged there before it is fixed, with symptom, evidence, cause, the rule
  that catches it, and status.
- REQ1.2 `src/validation/` runs as the pipeline stage between score and
  publish. Rules carry an ID and a severity; any `block` finding ends the run
  with `PIPELINE RUN FAILED: data validation ...` and the previous snapshot
  stays live. The report is written beside the scored CSVs.
- REQ1.3 Disaggregated source rows are reduced to one row per country, year
  and series by explicit rules before scoring (`src/calculating/dimensions.py`).
  A new disaggregation that no rule covers is a blocking finding, never a
  silent pick.
- REQ1.4 Aggregates (subdomain, pillar, overall, regional) use a basket mean:
  members with a value in the last five years form the basket, a year is
  scored only when at least 75% of the basket is present, members outside the
  basket are ignored. The pipeline and the frontend implement the same rule
  with the same constants. Years with an incomplete basket are null, never
  interpolated.

Rules shipped: R1 conflicting duplicates (block), R2 score shape and ghost
scores (block), R3 sawtooth series (block when systemic, warn for one
country), R4 flat runs (warn until the scoring decision), R5 pinned share
(warn), R6 basket presence (block), R7 single-member pillar (warn), R8
country identity (block), R9 year sanity (block).

Acceptance:

- AC1.6 `python -m src.validation` against the current scored outputs reports
  zero blocking findings; CI's backend tests cover every rule.
- AC1.7 The log has an entry for every defect observed on the dashboard
  since the 2026-10-14 review, and every entry names a rule or says why no
  rule is possible.
- AC1.8 No series in the published `timeseries.json` has three or more
  sign-alternating jumps of 25 points unless logged as genuine.

### 1.8 Raw data store and independent audit (added 2026-10-14, Thomas)

Trust in the published numbers is rebuilt by re-deriving them from raw with
code that does not touch the pipeline, and reconciling number by number.

- REQ1.5 Every pipeline run writes a lossless raw data store
  (`docs/raw-data-store.md`): every fetched file byte for byte with hashes,
  archives and spreadsheets extracted, every API record flattened with every
  field, and an inventory per source and series of countries, years and
  record counts. On by default; same run id as the published snapshot.
- REQ1.6 UN SDG and World Bank fetch from 1990, the dashboard axis, not 2010.
- REQ1.7 After a pipeline run, an independent audit runs from the store:
  one agent per source re-derives expected dashboard values from the raw
  records and the spec with no pipeline imports; a record-accounting pass
  explains every drop between raw and published; a deterministic reconciler
  (`audit/reconcile.py`) compares expected and published for every country,
  year and indicator; each mismatch class is root-caused and logged in
  `docs/data-quality-issues.md`.

Acceptance:

- AC1.9 The store for a run reproduces the inventory of the pipeline's clean
  tables: every series, country and year the pipeline published appears in
  the store with a raw record.
- AC1.10 Agreement per indicator between the independent derivation and the
  published values is reported; anything under 100% has a named cause.
- AC1.11 Every raw record is accounted for: published, or dropped with a
  stated reason.

---

## 2. Side panel redesign

### 2.1 Problem

On country click the panel shows seven pillar tiles, each with score, need
band, "latest" badge, coverage fraction, year and trend arrow, followed by a
seven-series trend chart and a sub-domain breakdown. Everything is open at
once. the reviewer's words: "too much data at once."

### 2.2 Requirements

- REQ2.1 First view shows country name, overall score and need band, then
  seven pillar rows with score and need band only. Nothing else on first paint.
- REQ2.2 Coverage fraction, latest year and trend arrow appear on hover or on
  expanding a pillar row, not in the default tile.
- REQ2.3 Trend chart defaults to the overall score plus at most the pillar the
  user expanded. Full seven-series overlay is a toggle, off by default.
- REQ2.4 Sub-domain breakdown lives behind a single disclosure per pillar.
- REQ2.5 Panel width stays fixed; no horizontal clipping of tile labels (the
  screenshots show "GENDE / LOW NE" truncation at the right edge).
- REQ2.6 All changes go through the existing design tokens and components in
  `dashboard/src/components/map/`; no one-off styles.

### 2.3 Acceptance criteria

- AC2.1 On a 1280 px wide viewport, the panel above the fold shows at most
  8 numbers (overall plus seven pillars).
- AC2.2 Every value hidden by default is reachable within one click.
- AC2.3 Screenshot review with the reviewer before merge; she signs off the layout.

---

## 3. Client-operable refresh

### 3.1 What the reviewer asked for

The team wants to run the six-month refresh themselves, from Azure, so they
understand how the backend works. Her sketch: drop a new ND-GAIN ZIP into
Blob, press a run button or restart a container, and see "Pipeline Run
Complete" in the logs. Thomas's note: the exact mechanism is open; pick
whatever is simplest to describe in the playbook and reliable to run.

### 3.2 What exists today

| Piece | Status |
|-------|--------|
| Pipeline container image, CMD-overridable | Built and verified in CI |
| Container registry `TSIcontainers`, Canada Central | Exists |
| Execution host (Container Apps Job, ACI) | Not chosen, not built; tracked as deferred in HANDOFF and TASKS |
| ND-GAIN input | Read from a local ZIP path in `settings.yaml`; Blob is not consulted |
| Other sources (UN SDG, World Bank, UNDP HDR, WGI) | Fetched from public APIs when `runtime.fetch_raw` is true |
| End-of-run signal | None. No structured completion log line |
| Credentials | One service principal, Storage Blob Data Contributor only, secret with a recorded expiry |

### 3.3 Design principle

**The refresh must be fully describable in the playbook with screenshots and
no terminal.** Any step that needs `az`, Python or git fails this requirement.

### 3.4 Requirements

- REQ3.1 A single Azure Container Apps Job, manual trigger, in resource group
  `tsi-data-dashboard`, running the existing pipeline image.
- REQ3.2 The job authenticates with a managed identity, not the service
  principal secret, so nothing expires on the client's side.
- REQ3.3 ND-GAIN is read from a Blob container (`sources/ndgain/`) at run
  time. The job picks the newest ZIP by name or by last-modified time and logs
  which file it used.
- REQ3.4 All other sources fetch live inside the job (`runtime.fetch_raw`
  true). Rate limits on UN SDG are handled by the existing fetcher; the job
  timeout accommodates the slow path.
- REQ3.5 The run ends with one unambiguous log line, for example
  `PIPELINE RUN COMPLETE: published v1 snapshot <timestamp>, <n> countries`,
  or `PIPELINE RUN FAILED: <stage> <reason>`, as the last line of output.
- REQ3.6 Validation still gates publish. A failed run leaves the previous
  `/v1/` snapshot live and says so in the failure line.
- REQ3.7 A failed execution sends an email alert to a client-owned address
  (Azure Monitor alert rule on job execution failure).
- REQ3.8 The playbook (§4) is written against this job and nothing else.

### 3.5 Non-requirements

- No scheduled trigger. Manual only, so the client decides when a refresh
  happens and nothing runs unattended.
- No web UI beyond the Azure portal.
- No change to the frontend contract.

### 3.6 Acceptance criteria

- AC3.1 A PlanCatalyst staff member with Contributor on the resource group can
  complete a refresh end to end using only the playbook and the portal.
- AC3.2 Dropping a ZIP with a new year into `sources/ndgain/` and running the
  job produces a `/v1/` snapshot whose `meta.json` shows the new source
  version.
- AC3.3 Uploading a malformed ZIP produces a failed run, the failure log line
  names the ND-GAIN stage, and the live `/v1/` is unchanged.
- AC3.4 The job's identity has exactly the roles needed: Storage Blob Data
  Contributor on the dashboard storage account and AcrPull on the registry.
- AC3.5 `docs/runbook-refresh.md` is reduced to the engineer rollback path
  and points to the playbook for the routine refresh.

### 3.7 Open questions

- Which Azure role does the reviewer's team already hold on the resource group?
  Determines whether a custom role or a built-in one is needed. **TODO: ask.**
- Should the IT team or Thomas create the managed identity? The original
  IT request in `docs/azure-it-request.md` predates this.
- Second principal `tsi-analytics` holds the same role on `dashboard-public`
  (seen 2026-09-29). On the call nobody could say who created it (a contributor or
  IT). Confirm its owner and purpose; if unused, ask IT to remove it. **TODO.**

---

## 4. Six-month playbook (Word document)

### 4.1 Audience

PlanCatalyst staff. No engineering background assumed. the reviewer's phrase: they
want to "actually understand how the application works in the backend."

### 4.2 Required contents

1. One-page picture of the system: sources in, pipeline, Blob, frontend in
   Wix. One diagram, no code.
2. What changes every six months and what does not (ND-GAIN is the only
   manual upload; everything else is automatic).
3. Before you start: who needs which Azure access, how to check the secret or
   identity has not expired, how to confirm the current live snapshot.
4. Step-by-step refresh with a portal screenshot per step: download ND-GAIN
   ZIP, upload to Blob, start the job, watch the logs, read the completion
   line, spot-check three countries on the dashboard.
5. What a failure looks like and what to do: the three most likely failure
   lines, what each means, and when to contact Thomas.
6. Rollback: how to restore the previous snapshot from the portal.
7. Glossary of terms that appear in the logs and on the dashboard
   (pillar, indicator, snapshot, need band, benchmark).
8. Contacts and ownership table.

### 4.3 Acceptance criteria

- AC4.1 Delivered as `.docx` and kept in the repo under `docs/playbook/`
  with the screenshots as separate image files so they can be refreshed.
- AC4.2 A dry run: the reviewer or a colleague follows the document once with Thomas
  observing but not helping. Any step they stall on gets rewritten.
- AC4.3 No command-line instruction anywhere in the document.

---

## 5. Admin and housekeeping

- Thomas's contact for the project is his Gmail from now on.
- The PlanCatalyst email account stays open for now and is closed later once
  it is confirmed nothing depends on it (GitHub org membership, Azure
  sign-in, Wix). **Before closing, verify no Azure resource or GitHub
  permission is bound to that identity.**
- Resource group `tsi-data-dashboard` was created by Thomas. Ownership and
  subscription are PlanCatalyst's.

---

## 6. Delivery: two passes, then ops

### Pass A: data validation and faithfulness

Goal: every number and line on the dashboard is one a domain reader can
defend. Covers §1 and §1.6.

```
A1. Scoring decision (§1.4) ........ needs the reviewer; blocks the A2 switch and republish
A2. Scorer change + SCORING_AUDIT + index_version bump + republish (§1)
    ... built 2026-10-14 as `scoring.below_benchmark: clamp | soft_floor`
        (default clamp, AC1.4 tests, AC1.2 audit text). Open: flip, bump, republish after A1.
A3. Clamp audit across all RatioThreshold / InverseRatio indicators (§1.2)
    ... done, `scripts/clamp_audit.py --write-audit`, table in SCORING_AUDIT.md
A4. Single-indicator pillar rule or warning (§1.6, Brazil agriculture)
    ... done as the "n of m" badge on low-confidence pillar rows (B3)
A5. Regional averages: suppress or shade sparse years (§1.6)
    ... done, years under 50% regional coverage are not drawn, noted under the chart
A6. Remove the projection placeholder (§1.6, B4) ... done, chart and About page
AC1.5 benchmark sentence in the data notes ........ done (BENCHMARK_RULE_NOTE)
A7. Data validation module, issue log, dimension rules, basket aggregation (§1.7)
    ... done 2026-10-14. Found and fixed on first run: 93 ghost scores from
        missing values (DQ-06), alternating disaggregations in 85 countries
        (DQ-02), composition zigzag in every country (DQ-03).
```

### Pass B: UI/UX

Goal: the dashboard reads as a PlanCatalyst product, is operable without
confusion, and has no layout bugs. Covers §2 and §7. Design and motion
system approved 2026-10-14; reference page linked at the top of this
document.

```
B1. Tokens file, Google Fonts, nav underline (§7.4) ............ done 2026-10-14, fcb72f3
B2. Panel layout to flex + width; close resets expand (§7.2 B1, B1b) ... done, 884defc
B3. Panel rebuild on the score-row pattern (§2, §7) ............ done, eb7a10d
B4. Legend and tooltip as tokenised components; map component untouched (§7.2 B3, REQ7.11a) ... done, 2f3fed4
B5. Remaining routes: Explore, Compare, About, Trends (§7) ..... done, d476f5c
B6. Reveal hook and motion tokens wired (§7.5) ................. done, ad25976
B7. CI hex and radius guardrail (REQ7.6) ....................... done, 31a4d65
B8. Before/after screenshots and the reviewer review (AC2.3, AC7.7) ... open
B9. About page rebuild: wiki layout, 14 sections, live visuals (§9) ... open
```

Notes from the build (2026-10-14):

- The v1 choropleth ramp reads darker = higher score (lower need). B4 kept
  that direction and only swapped hex for `--map-*` tokens. Flipping to
  darker = higher need, as the design system proposes, is a token reorder
  in `WorldChoropleth.tsx` once the reviewer answers the open question.
- Pillar, region and country colours come from one module,
  `dashboard/src/components/scores/series-color.ts`. The contract's
  `pillar.color` is no longer read by the UI.
- SVG fills and strokes are set through `style` rather than presentation
  attributes so `var()` resolves in every browser.

### Pass C: operations and handoff

```
C1. Container Apps Job + Blob-sourced ND-GAIN + completion line + alert (§3)
    ... code done 2026-10-14: completion and failure lines (REQ3.5, 3.6),
        managed identity capable credential (REQ3.2), newest-ZIP Blob source
        with logged file (REQ3.3), env overrides for the job, provisioning
        script `infra/container-apps-job.sh` with roles and alert (REQ3.1,
        3.7, AC3.4). Open: run the script against Azure (Thomas), first
        execution, AC3.2 and AC3.3 checks against the real job.
C2. Playbook draft (§4) ............ text drafted in docs/playbook/playbook.md;
        screenshots and .docx wait on C1 execution
C3. Playbook dry run with client (§4, AC4.2) ... open
C4. Vault and HANDOFF updates, close out ... running
```
AC3.5 runbook reduced to the engineer path ... done

Pass A and Pass B run in parallel; A1 is the only external dependency.
Pass C starts once the job exists. B1 comes before any other B item so
nothing is styled twice.

---

## 7. UI modernisation, design system and motion

**Approved 2026-10-14 (Thomas).** The design system and motion system are
final for v2. Reference page: https://claude.ai/artifact/8uYYAMdRPDARvscBYUM47Z
Source of truth in the repo: `docs/design-system/index.html`; its `:root`
block becomes `dashboard/src/styles/tokens.css` unchanged. Any later
change to a token or motion value is made on that page first, then in code.
the reviewer reviews the result through the before/after screenshots (AC7.7), not
the token values.

### 7.1 Problem

The dashboard inherited its look from the client's original spec, a single
dense HTML mock. A token file exists (`dashboard/src/styles/tokens.css`,
23 lines) but the codebase has drifted away from it:

| Drift measure (2026-10-14) | Count |
|----------------------------|-------|
| `border-radius` declarations in `components.css` | 28, across 11 distinct values |
| Hex literals in CSS outside `tokens.css` | 53 |
| TSX files carrying inline `style={{}}` | 11 of 15 |
| Distinct hex literals inside TS/TSX | 20 |
| Ad-hoc `transition` rules, all 0.1 to 0.28s | 5 |

Nav links are pill-shaped (`999px` radius); the brand is square. Body font
is Inter; the brand uses Montserrat. The result reads as a generic admin
template rather than a PlanCatalyst product.

### 7.2 Known UI bugs

| ID | Symptom | Cause (verified) | Fix |
|----|---------|------------------|-----|
| B1 | Expand the panel, click the close X: the selection clears but the map stays at one quarter width with an empty panel | `MapPage.tsx` keeps `selectedIso3` and `panelExpanded` as independent state; `onClose` only clears the first | Close resets both, and `expanded` is derived as `panelExpanded && selected !== null` so the states cannot diverge |
| B1b | Expand and collapse snap instead of animating in Safari and feel broken | Transition is on `grid-template-columns`, which WebKit does not animate | Flex row, animate the panel `width` (REQ7.11b) |
| B2 | Pillar tile labels clip at the panel edge ("GENDE", "LOW NE") | Fixed-width tile grid with no wrap at 380 px | Tiles reflow to rows in the redesign (§2) |
| B3 | Map legend card sits half off-screen at the left on mid widths | Absolute overlay with hardcoded `minWidth` inline style | Legend becomes a tokenised component anchored inside the map bounds |
| B4 | "Projection band coming soon" placeholder visible in production | Unfinished feature left in the panel | Remove until projections ship (§8) |
| B5 | Others found during the redesign | | Logged in `TASKS.md` as they appear |

### 7.3 Brand extraction from plancatalyst.org (2026-10-14)

Pulled from the live Wix site's theme variables and inline styles.

**Colour**

| Role | Hex | Evidence |
|------|-----|----------|
| Brand blue | `#0079C1` | Headline accent words, 11 uses |
| Brand green | `#B2CD5A` | Headline accent words ("apart", "services") |
| Slate | `#2B5672` | Secondary text and social icons, 22 uses |
| Navy | `#1A2B6D` | Theme accent `--color_24`, 7 uses |
| Ink | `#333333` / `#000000` | Body text |
| Grey 1 to 3 | `#F2F2F2`, `#C7C7C7`, `#757575` | Surfaces, rules, muted text |
| Surface | `#FFFFFF` | Page background everywhere |

**Type**

| Role on the site | Font | Dashboard decision |
|------------------|------|--------------------|
| Headings | Montserrat Bold, 66 / 55 / 23 px | Montserrat 600 and 700 via Google Fonts |
| Body | DIN Next Light 16 px, line-height 1.4 | Licensed Wix font, not available. Keep Inter for body and numerals; it has tabular figures, which a data UI needs |
| Sub-headings | Spinnaker 40 / 35 / 28 px | Dropped. Two families is enough |

**Shape and space.** Site sections and buttons are square (`border-radius:
0`). The only rounding is on circular social icons and a few image cards.
Section padding is 30 px and 30/60 px; micro padding 4 and 8 px. Thin 1 px
rules separate content. Generous whitespace, photography-led, no shadows.

### 7.4 Design system requirements

- REQ7.1 One token file is the source of truth. Tokens cover colour (brand,
  neutral, need bands, chart series), type scale, spacing on a 4 px base,
  radius (0, plus full for dots only), border, one shadow level at most,
  z-index layers, breakpoints, and motion durations and easings.
- REQ7.2 No hex literal, radius value, duration or easing appears outside the
  token file. Components consume tokens only.
- REQ7.3 Need-band colours keep their current semantics (cool for low need,
  warm for severe) but are re-tuned to sit with the brand palette and pass
  colour-blind checks. The choropleth sequential scale derives from them.
- REQ7.4 Component set: Button (primary, secondary, ghost, icon), Chip and
  Badge (need band, data status), Panel chrome (title, close, expand),
  Score tile, Section header, Disclosure, Table with sortable header,
  Legend, Tooltip, Nav link, Loading / Empty / Error cards.
- REQ7.5 The design system is delivered as a commented HTML reference page
  in the repo at `docs/design-system/index.html`, published at
  https://claude.ai/artifact/8uYYAMdRPDARvscBYUM47Z. It carries the tokens as CSS
  variables, a specimen of every component in every state, and the motion
  specimens, so implementation has one thing to build against. Delivered
  and approved 2026-10-14.
- REQ7.6 CI guardrail: a grep step fails the build if a hex literal appears
  in `dashboard/src` outside the token file.
- REQ7.6a CI guardrail for controls: `npm run lint:components` fails when a
  `<button>` carries a class that is not a registered design system component
  (`dashboard/scripts/component-registry.json`), when a retired class
  (`fbtn`, `chart-ind-btn`) returns, or when a registered component has no
  specimen on the design system page. Controls that exist but are not yet in
  the design system are listed as `legacy`; that list may only shrink.
  Added 2026-10-15 after the About page shipped a third selector style.
- REQ7.7 Responsive behaviour is part of the system: breakpoints, panel
  behaviour under 1024 px, and iframe height handling are defined once.

### 7.5 Motion system requirements

- REQ7.8 Durations: reveal 1.0 to 1.2 s, layout move 0.6 to 0.8 s, micro
  (hover, press, focus) 0.2 s. Easing: quint-out
  `cubic-bezier(0.22, 1, 0.36, 1)` for entrances, ease-in-out for layout
  changes. No expo-out or spring overshoot anywhere.
- REQ7.9 Reveals combine opacity with 12 to 16 px of travel, staggered at
  0.12 s in visual-hierarchy order: country name and overall score first,
  then pillar rows, then the chart, then the breakdown.
- REQ7.10 Panel open is a slide-and-fade. Panel expand and collapse animate
  the grid columns over 0.6 s ease-in-out; the map re-projects once on
  transition end, not per frame.
- REQ7.11 Map country hover fill 0.2 s; selected country gets an outline, no
  pulse. Chart lines draw in on first render only.
- REQ7.11a The choropleth is not rebuilt. `WorldChoropleth.tsx` keeps its
  projection, TopoJSON handling and interaction. It only reads colours and
  the hover duration from tokens and re-projects once on `transitionend`.
  Everything around the map (legend, tooltip, panel, nav, pages) is in
  scope.
- REQ7.11b Panel expand and collapse animate the panel's width inside a flex
  row, not `grid-template-columns`. Safari does not animate grid tracks, so
  the current implementation snaps there and `transitionend` never fires.
- REQ7.12 `prefers-reduced-motion` collapses every reveal and layout
  transition to instant.
- REQ7.13 No motion library. CSS transitions and keyframes plus one small
  reveal hook. The project has no animation dependency today and does not
  need one.

### 7.6 Acceptance criteria

- AC7.1 `grep` for hex literals in `dashboard/src` outside the token file
  returns zero. Enforced by `npm run lint:tokens` in CI (delivered B7).
- AC7.2 Every `border-radius` in the codebase is `0` or `50%`. Same script.
- AC7.3 Closing the panel restores the map to full width; expand state does
  not survive a close (B1).
- AC7.4 Every transition references a motion token; no literal durations in
  component CSS.
- AC7.5 Reduced-motion verified with the OS setting on.
- AC7.6 Lighthouse accessibility 95 or higher on the Map route; all text
  tokens pass WCAG AA contrast on white and on `#F2F2F2`.
- AC7.7 Before and after screenshots of Map, Compare and About for the reviewer's
  sign-off.

---

## 8. Out of scope for v2

- Any analytics or usage tracking (client decision, see vault).
- Projection bands. Remove the placeholder or ship separately.
- Changes to the pillar taxonomy or indicator list.
- Scheduled or automatic refreshes.

---

## 9. About page: methodology, decisions and known oddities

**Added 2026-10-15 (Thomas).** Direction from Thomas, expanded here. Visual
reference: the audit explainer at https://claude.ai/artifact/CMLqZaakkKJAXoDJpdLLZ5
(same tokens, same motion, the treatment the About page should reach).

### 9.1 Problem

The About page today is three short methodology paragraphs, a source list and
the framework grid. It does not explain most of what we decided while
building the dashboard, and parts of it are now wrong:

- It says pillar and subdomain scores are "simple arithmetic means for the
  selected year". Since DQ-03 they are basket means (§1.7).
- It says the population density direction is pending. It was confirmed on
  2026-09-17 (`SCORING_AUDIT.md` row 27).
- It gives ND-GAIN as 1995 to 2023. The 2026 release runs to 2024.
- It still carries a deferred note for `conces`, which `mspi` replaced.
- It points readers at repository files (`indicators.yaml`,
  `SCORING_AUDIT.md`) that a public reader cannot open.
- Indicator text that reaches the page through `meta.json` has errors at the
  source: `sanit` is labelled "not using" safely managed sanitation, `susag`
  says "Score from 1-5" for a percentage, and the `u5mr` unit is malformed.
- The copy uses em dashes and repository jargon.

Meanwhile readers see things that look like bugs and are not: lines pinned at
100, single-country sawtooth, series that start late or stop early, pillars
with no early years, and a projections slot that is always empty. Nothing on
the page tells them why. the reviewer asked the same questions in the 2026-10-14
review (§1.1).

### 9.2 Goal

The About page is where the dashboard explains itself. A domain reader
(the reviewer, a funder, a member of the public) should be able to answer three
questions there without contacting us:

1. **How was this number made?** From the source file to the score on screen.
2. **Why does this chart look like that?** Every visible oddity has an
   entry with its cause and whether it is a property of the data, a
   deliberate rule, or an open issue.
3. **What did you decide, and what is still open?** Every material
   methodology decision, who made it, when, and its status.

It does this by showing as well as telling: each concept gets an
interactive visual built on real data from the current snapshot, with the
plain-language answer first and the detail one click away.

### 9.3 Page structure

- REQ9.1 **Wiki layout, built for the worst-case embed.** A left rail lists
  every section and its subsections; the reading column sits to the right at
  about 65 characters. The rail highlights the section in view (scroll spy)
  and collapses its subsection lists to the current section. The Wix embed
  mode is unknown, so the layout assumes the worst case (auto-height iframe,
  §9.7), where nothing inside the iframe can follow the reader's scroll:
  - The rail is collapsible. A "Contents" toggle at its top hides it to a
    slim strip and gives the reading column the full width; the choice is a
    per-viewer convenience and the page works without it.
  - Navigation never depends on the rail staying in view. Every section ends
    with a "Back to contents" link, and every section heading carries a
    small "Contents" button that reopens the rail at the top of the page.
  - `position: sticky` is a progressive enhancement only. If the iframe has
    its own scroll (fixed height), the rail sticks; if not, it scrolls away
    and the links above carry navigation. No layout or test may assume it
    sticks.
  - Below 1024 px the rail becomes an "On this page" disclosure at the top
    of the column, closed by default.
- REQ9.2 **Deep links.** Every section and subsection has a stable id and a
  route of the form `#/about/<section>` (the app uses `HashRouter`, so plain
  `#anchor` links do not work). Opening such a link scrolls to the section
  and expands it. Other pages link into About this way (see REQ9.9).
- REQ9.3 **Progressive disclosure.** Each section opens with a short answer
  of two or three sentences that is always visible, then its visual, then
  "The detail" as a collapsible Disclosure (REQ7.4). An "Expand all" and
  "Collapse all" control sits at the top of the rail. Expanded state is a
  per-viewer convenience only; nothing breaks without it.
- REQ9.4 **Section anatomy.** Every section carries the same parts in the
  same order: short answer, visual, detail, "See it on the dashboard" link
  where one applies, and a provenance line (date, status chip:
  Locked, Pending client decision, Open issue). The status chips come from
  one decisions module (REQ9.12) so a decision changes in one place.
- REQ9.5 **Filter.** A text box at the top of the rail filters sections and
  glossary terms by title and keywords. Client-side only; no search engine.

### 9.4 Sections and their visuals

Order is the reading order. Visuals marked *live* compute from the `/v1`
contract the dashboard already loads; *static* ones use values stored in the
content module with the snapshot id they belong to.

| # | Section | Short answer covers | Visual |
|---|---------|---------------------|--------|
| 1 | What this dashboard is | Decision support for country-level need, not impact attribution. 216 countries, 28 indicators, 7 pillars, 17 subdomains, 1990 to 2024. | Framework tree: pillars to subdomains to indicators, click to expand (replaces the current card grid). *live* |
| 2 | Reading a score | 0 to 100, higher is better (less need). Need bands at 75, 50, 25. A dash means no data, never zero. | Score scale with the four need bands; hover a band to see example countries from the current year. *live* |
| 3 | From source to screen | The pipeline in seven stages: fetch, raw store, clean, choose the right row, score, check, combine and publish. | Animated stage diagram. Click a stage to see what it does, and follow one real record (Brazil tuberculosis, latest year) through every stage with its value at each step. *static, stamped with run id* |
| 4 | How each indicator is scored | Five scoring families: ratio to a threshold, gap to a coverage benchmark, share of a goal, index already 0 to 100, density bands. | One interactive curve per family: drag the raw value, watch need and the displayed score move, benchmark marked. Below it, a sortable table of all 28 indicators: source, unit, family, benchmark. *static (generated, REQ9.11)* |
| 5 | Why some lines sit flat at 100 | The benchmark rule: any country better than the client benchmark scores 100, so better-performing countries tie and show no trend (DQ-01). | Brazil climate vulnerability as a line, with a toggle between the current rule and the proposed soft floor (values from `SCORING_AUDIT.md`). Status: Pending client decision until the reviewer rules, then Locked. *static* |
| 6 | Choosing the right number from the source | Sources publish several rows per country-year (by sex, age, area). We keep national totals; adolescent births use ages 15 to 19; IHR is the mean of 13 capacities; bank accounts use adults 15+; women-only measures use the women's figure; city-only rows are never used as national. | Before and after toggle on the Brazil reproductive health sawtooth (DQ-02): 100, 31, 100, 31 becomes one honest line. *static* |
| 7 | Combining indicators into pillars | Basket rule: an indicator counts toward a pillar if it reported in the last five years; a year is scored only when 75% of the basket is present (DQ-03). Explains why early years disappear and what the "n of m" badge means (DQ-05). | Basket grid: indicators as rows, years as columns, filled cells where data exists, with the scored years marked underneath. Toggle "old rule" to see the 1996 to 1998 zigzag (70.5, 80.2, 69.7) return. Country picker. *live* |
| 8 | Why a chart might look odd | A gallery of every known oddity, each with symptom, cause, and whether it is data, rule or open issue. | Small-multiple sparklines from real series, one per oddity, each linking to the country and indicator on the dashboard. *live* |
| 9 | Missing data and projections | Why a value is blank (`out_of_scope` vs `incomplete_data`), and why projections are not shown: forecasts are off in this release, and when on, a series must pass five quality gates; we never carry the last value forward. | Gate funnel diagram (insufficient observations, insufficient span, stale, too sparse, no signal), labelled illustrative while `meta.projections.enabled` is false. Coverage heatmap: indicators by year, shaded by share of countries reporting. *live* |
| 10 | Sources and refresh | Six sources, what each provides, years covered, licence, and the six-month refresh. | Source cards with coverage bars by year. *live coverage, static text* |
| 11 | How we check the data | Nine validation rules run before every publish and block bad data; an independent audit rebuilds every score from raw files. | The audit proportion bar from the explainer artifact (matches, gaps by verdict), and the issue log as status chips. *static, stamped with run id* |
| 12 | Decisions log | Every material decision with date, decider and status. | Filterable table (All, Locked, Pending). *static* |
| 13 | Glossary | Need, benchmark, clamp, basket, pillar, subdomain, indicator status, SDG series, ISO3. | Terms with hover definitions linked from the rest of the page. *static* |
| 14 | This release | Snapshot id, generated date, index version, what changed since the last release. | Release card. *live (meta), static changelog* |

Section 8 starts with at least these entries, each tied to its issue ID:

| Oddity | Cause | Kind |
|--------|-------|------|
| Line flat at 100 for years | Benchmark clamp (DQ-01) | Rule, pending decision |
| Sawtooth in one small country (Niue tuberculosis; Palau on the page, because Niue is not among the 216 countries shown) | A few cases move the rate in a population of a few thousand (DQ-09) | Data |
| Jagged agriculture aid | Aid disbursements are lumpy by nature (DQ-08) | Data |
| Series starts late or stops early | Source coverage: IHR 2010 to 2017 only, WASH mortality 2019 only, WGI every other year before 2002, MPI only in survey years | Data |
| Pillar has no early years | Basket rule needs 75% of the pillar's indicators (DQ-03) | Rule |
| Regional line has gaps | Years where fewer than half the region's countries report are not drawn (DQ-04) | Rule |
| Pillar score marked "1 of 3" | Only one indicator reported that year (DQ-05) | Rule |
| Dense countries score 0 on population density | Banded scale, denser means more need, confirmed 2026-09-17 | Rule |
| Sustainable agriculture shows only a handful of countries | The source reports for about 10 countries | Data |
| No overall score while a core pillar is blank | Overall is null unless the six core pillars have a score; socio-economic performance is optional (decided 2026-10-15) | Rule, locked |

- REQ9.16 **Sources first.** The page opens with every data source as a
  large cell in a grid, above the wiki: source name, provider, what the
  dashboard takes from it, why it is used, how many indicators it feeds, the
  years it covers (read from the loaded data) and a link to the provider.
  Added 2026-10-15 (Thomas). Section 10 keeps the coverage bars and the
  refresh detail.
- REQ9.17 **Open a country from a link.** `#/map?country=ISO3` opens that
  country's panel on the Map, so About cards can link to a real country. The
  indicator inside the panel is named in the link text; the panel does not
  preselect it.

### 9.5 Interaction and motion

- REQ9.6 Every visual uses the §7 tokens and motion system: reveals at
  1.1 s quint-out with 0.12 s stagger in visual-hierarchy order, chart lines
  draw in on first render only, Disclosure height animates over 0.6 s
  ease-in-out. One orchestrated moment per section at most; no ambient
  motion. `prefers-reduced-motion` makes everything instant (REQ7.12).
- REQ9.7 Every interactive visual works by keyboard, has a visible focus
  state, and has a text equivalent: the short answer states its point, and
  a "Show as table" toggle gives the numbers behind it.
- REQ9.8 Visuals inside a collapsed Disclosure do not mount until opened, so
  the page loads fast inside the Wix iframe. The About route is a lazy
  chunk. **As built 2026-10-15:** each section's visual sits above its detail
  and mounts when the reader scrolls within 900 px of it (with a reserved
  minimum height so the page does not jump); the detail mounts when opened.
  Nothing mounts at page load except the source grid and the rail.
- REQ9.9 **Explain-in-place links.** Wherever the dashboard shows an oddity,
  a small "Why?" link opens the matching About section: the flat-at-100 tile
  in the side panel, the "n of m" badge, a blank projection slot, the
  regional gap note, a deferred or out-of-scope indicator. These replace the
  scattered one-off notes in `content/data-notes.ts` as the long-form
  explanation; the short notes stay as tooltips.

### 9.6 Content and data rules

- REQ9.10 Copy lives in `dashboard/src/content/about/`, one module per
  section, so text changes never touch components. Voice: plain language for
  a domain reader, active voice, no em dashes, no repository paths or code
  names in public copy (series codes may appear in the detail as a
  reference). Follows the writing rules used for the rest of the UI.
  Added 2026-10-15 (Thomas): the voice follows PlanCatalyst's own site, with
  "we" for PlanCatalyst and "you" for the reader, short plain sentences, and
  the meaning before the arithmetic. `check:about` rejects "client" and process
  vocabulary in public copy. The status label "Pending client decision" is now
  "Decision pending".
- REQ9.11 The per-indicator methodology table (section 4) is hand-kept in
  `dashboard/src/content/about/methodology.ts` and checked by
  `npm run check:about` against `public/v1/meta.json` (all 28 indicators
  present, keys, source and unit agree). **Changed 2026-10-15 (Thomas):** the
  originally specified generator from `indicators/indicators.yaml` and the
  scorer constants is deferred to `TASKS.md`; this release is frontend only.
  Benchmarks and scoring families are read from the scorer code, not the
  yaml, and any yaml versus code drift found is named in the section detail.
- REQ9.12 One decisions module (`content/about/decisions.ts`) holds every
  pipeline data decision: id, title, the consideration, what the dashboard
  decided, why, date, status, linked issue IDs. Entries name no people or
  roles (Q9.2, decided 2026-10-15). Status
  chips in every section and the log in section 12 read from it.
- REQ9.13 Runtime data comes only from the `/v1` contract the app already
  loads (hard invariant 1). Static figures (audit totals, example values)
  carry the snapshot id they belong to; if it differs from
  `meta.pipelineRunId`, the visual shows "from snapshot <id>" instead of
  presenting old numbers as current.
- REQ9.14 Fix the stale and wrong content listed in §9.1 at its source:
  page copy in `content/about/`. **Changed 2026-10-15 (Thomas):** the three
  wrong indicator labels (`sanit`, `susag`, `u5mr`) are corrected on the
  About page only through overrides in `methodology.ts`; fixing them in
  `indicators/indicators.yaml` (which flows into `meta.json` and every other
  page) is deferred to `TASKS.md` and the next pipeline publish.
- REQ9.15 Sections that describe a pending client decision (section 5, the
  overall-score rule, the debt-risk input rule) are written so they stay
  true either way, and are updated in the same change that applies the
  decision.

### 9.7 Risks and checks

- The dashboard is embedded in Wix. If the embed grows to the content height,
  a sticky rail inside the iframe never sticks, because the iframe itself
  scrolls with the parent page, and `position: fixed` fails the same way.
  The embed mode is unknown, so REQ9.1 designs for auto-height: collapsible
  rail, "Back to contents" and per-heading "Contents" links, sticky as an
  enhancement only. Following the parent's scroll would need Wix custom code
  posting scroll offsets into the iframe; out of scope.
- The page is public. Section 8, section 11 and the decisions log explain our
  own open issues. the reviewer approves the level of candour before release (open
  question below).
- Live visuals add work to the About route. Keep each under one pass over
  the timeseries for one country or indicator; no whole-dataset scans on
  load.

### 9.8 Acceptance criteria

- AC9.1 Every item in §9.1 is fixed; the page no longer contradicts
  `docs/data-quality-issues.md`, `SCORING_AUDIT.md` or the contract.
- AC9.2 Each of the 14 sections has a short answer, a visual, a detail
  disclosure and a provenance line. Every entry in section 8 links to a
  real country and indicator on the dashboard and shows the effect.
- AC9.3 Every `#/about/<section>` link opens the right section expanded,
  from a cold load and from another route.
- AC9.4 Keyboard only: the rail, every Disclosure, every toggle and slider
  can be reached and operated; focus is always visible.
- AC9.5 Reduced motion verified with the OS setting on; every visual still
  makes its point at rest.
- AC9.6 Works at 400 px and inside the Wix iframe with no horizontal page
  scroll. Every section is reachable from every other in two clicks with
  `position: sticky` disabled in dev tools (simulates the auto-height
  embed), and the rail collapses and reopens by keyboard.
- AC9.7 `npm run check:about` passes in CI; the methodology table matches
  `meta.json` for all 28 indicators and the content rules (no em dashes, no
  hex literals, no repository paths, no dangling decision references) hold.
- AC9.8 Lighthouse accessibility 95 or higher on the About route; zero hex
  literals outside the token file (AC7.1).
- AC9.9 the reviewer reads the page and can answer, without help, why Brazil's
  climate line is flat, why a pillar has no early years, and why there are
  no projections.

### 9.9 Non-requirements

- No CMS or remote content store; copy ships with the build.
- No full-text search engine; the rail filter is enough.
- No analytics on section views (client decision, §8).
- No new contract fields; the page reads what `/v1` already carries.

### 9.10 Scope of the first release

Decided 2026-10-15 (Thomas): all 14 sections in one release, built in staged
commits and deployed once. Frontend only; no pipeline, contract or
`indicators.yaml` change. Deploy path: pull request, Thomas approves, manual
`Deploy dashboard` workflow.

### 9.11 Open questions

- Q9.1 (the reviewer) How candid should the public page be about open issues?
  Options: full (issue IDs and status), summarised (cause and status, no
  IDs), or internal-only sections behind a query flag. Build default
  2026-10-15 (Thomas): summarised, behind one `CANDOUR` flag in
  `content/about/decisions.ts`; the reviewer approves the level before release.
- Q9.2 Should the decisions log name individuals or only roles? Decided
  2026-10-15: neither. See REQ9.12.
- Q9.3 (Thomas) Embed mode in Wix: fixed height with internal scroll, or
  auto-height. No longer blocking: REQ9.1 assumes auto-height (decided
  2026-10-15). Confirming fixed height only turns the sticky enhancement on.
