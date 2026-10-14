# Requirements: Delivery v2 (post-review, 2026-10-14)

**Status:** draft for client sign-off. §7 design and motion system **approved by Thomas 2026-10-14**.
**Source:** review call with Reyna (PlanCatalyst), 2026-10-14, plus repo verification the same day
**Owner:** Thomas
**Sign-off:** Reyna is the final authority on scoring and scope decisions
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

Reyna's feedback in one line: the data plumbing works, but the dashboard needs
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

---

## 1. Data faithfulness: benchmark clamping

### 1.1 What Reyna saw

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

### 1.4 Decision required (Reyna)

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
zigzags Reyna described were not one defect but three, and that the fix has
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

---

## 2. Side panel redesign

### 2.1 Problem

On country click the panel shows seven pillar tiles, each with score, need
band, "latest" badge, coverage fraction, year and trend arrow, followed by a
seven-series trend chart and a sub-domain breakdown. Everything is open at
once. Reyna's words: "too much data at once."

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
- AC2.3 Screenshot review with Reyna before merge; she signs off the layout.

---

## 3. Client-operable refresh

### 3.1 What Reyna asked for

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

- Which Azure role does Reyna's team already hold on the resource group?
  Determines whether a custom role or a built-in one is needed. **TODO: ask.**
- Should the IT team or Thomas create the managed identity? The original
  IT request in `docs/azure-it-request.md` predates this.
- Second principal `tsi-analytics` holds the same role on `dashboard-public`
  (seen 2026-09-29). On the call nobody could say who created it (Anthony or
  IT). Confirm its owner and purpose; if unused, ask IT to remove it. **TODO.**

---

## 4. Six-month playbook (Word document)

### 4.1 Audience

PlanCatalyst staff. No engineering background assumed. Reyna's phrase: they
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
- AC4.2 A dry run: Reyna or a colleague follows the document once with Thomas
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
A1. Scoring decision (§1.4) ........ needs Reyna; blocks the A2 switch and republish
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
B8. Before/after screenshots and Reyna review (AC2.3, AC7.7) ... open
```

Notes from the build (2026-10-14):

- The v1 choropleth ramp reads darker = higher score (lower need). B4 kept
  that direction and only swapped hex for `--map-*` tokens. Flipping to
  darker = higher need, as the design system proposes, is a token reorder
  in `WorldChoropleth.tsx` once Reyna answers the open question.
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
Reyna reviews the result through the before/after screenshots (AC7.7), not
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
- AC7.7 Before and after screenshots of Map, Compare and About for Reyna's
  sign-off.

---

## 8. Out of scope for v2

- Any analytics or usage tracking (client decision, see vault).
- Projection bands. Remove the placeholder or ship separately.
- Changes to the pillar taxonomy or indicator list.
- Scheduled or automatic refreshes.
