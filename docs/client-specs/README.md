# Client specification documents

Methodology documents supplied by PlanCatalyst for the Country Macro
Socio-Economic Performance Index (`mspi`), the composite that occupies the
`pri/macrosec` slot in the pillar taxonomy.

They are committed here so that anyone reading the pipeline can see the source
the code was written against, rather than taking our implementation notes on
faith. `docs/spec-macrosec-index.md` is the working engineering spec and carries
the full diff, the validation results and the open questions. These files are
the primary sources behind it.

| File | Received | Client version string |
|---|---|---|
| `mspi-spec-2026-09-17-original.docx` | 2026-09-17 | `index_version: 1.0` |
| `mspi-spec-2026-09-23-revised.docx` | 2026-09-24 | `index_version: 1.0` |

Both documents declare version `1.0` despite describing different outputs. The
repository therefore tracks a `client_doc_revision` date instead of trusting the
version string, and a bump to `1.1` has been requested.

## What changed between the two revisions

Unchanged: the formula, the four component weights, the normalisation bounds,
every World Bank series code, the WGI `source=3` selection, the debt carrying
capacity tiering and its thresholds, and the score mapping. The arithmetic of
the index did not move.

Changed: who appears in the output and how absence is labelled.

1. An explicit scope rule. A country is in scope if the World Bank classifies it
   as an IBRD, blend or IDA borrower, which is the proxy for whether it reports
   to the Debtor Reporting System.
2. A three-value `status` field: `scored`, `out_of_scope`, `incomplete_data`.
3. Every requested country appears in the output, scored or not.
4. `partial_scores: false`. No country receives a score computed from a subset
   of the four components.

## Why this history is worth keeping

### Absence has more than one meaning

The first revision produced a score or nothing. A country missing from the
output could have been out of scope, missing an upstream series, or dropped by a
bug, and the payload could not tell those apart. The second revision makes the
reason an explicit field.

This is the same principle as distinguishing HTTP 404 from 403 from 500. All
three are "you did not get the thing", and collapsing them into one response
destroys the information a consumer needs to decide what to do next. A null with
no reason attached is an unlabelled failure.

### Refusing to compute is sometimes the correct answer

The client's instruction not to produce partial scores is the strongest
methodological decision in either document, and the reasoning generalises.

The four components are income, fragility, debt risk and debt concessionality.
When data is missing it is almost never the income series that is absent, it is
the debt series, because the countries that stop reporting to the Debtor
Reporting System are the ones that stopped borrowing. So a partial score is not
a noisier estimate of the full score, it is a biased one: it systematically
omits the components that would pull the number down.

A biased number sitting in the same column as unbiased numbers is worse than an
empty cell, because the empty cell is visibly empty and the biased number is
not. Missing data that is missing for a reason correlated with the value you are
trying to measure cannot be averaged away.

### Validate a rule against live data before implementing it

The revised scope rule was run against the live World Bank country endpoint
before any code was written. It returns 145 countries where the document
anticipated roughly 120, and 15 of the 28 countries it would flag as
`incomplete_data` are high-income economies that graduated from IBRD borrowing
and stopped reporting. Those are out of scope, not data gaps.

Implementing the rule exactly as written would have shipped 15 standing false
alarms into a field whose entire purpose is to separate real gaps from
non-participation. The defect was in the specification, not the code, and it was
only visible by running the rule against reality.

### Test on behaviour, not on a label that correlates with it

The proposed refinement reclassifies a country as out of scope when it is in
scope by lending type but has no reporting history at all. The obvious
alternative, excluding high-income countries, gives the same answer for 15 of
the 16 relevant cases and the wrong answer for Guyana, which is high income,
still an IDA borrower, still reports, and still belongs in the index.

Testing on whether a country actually reports preserves the client's documented
Guyana exception without encoding it as a special case. A proxy that is right
most of the time will fail exactly where the interesting cases live.

## Provenance and handling

Authorship metadata in both files has been neutralised: the `dc:creator` and
`cp:lastModifiedBy` fields now read `PlanCatalyst` rather than naming an
individual. Document bodies are byte-identical to the files as received, which
was verified on copy. No other part of either file was modified.

Neither document contains credentials, endpoints private to PlanCatalyst, or
personal data. The only URLs are public World Bank API paths.
