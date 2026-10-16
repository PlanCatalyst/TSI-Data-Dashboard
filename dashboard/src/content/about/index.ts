import type { SectionContent } from "./types";
import { section as s01 } from "./s01-what-this-is";
import { section as s02 } from "./s02-reading-a-score";
import { section as s03 } from "./s03-source-to-screen";
import { section as s04 } from "./s04-scoring";
import { section as s05 } from "./s05-flat-at-100";
import { section as s06 } from "./s06-choosing-the-number";
import { section as s07 } from "./s07-pillars";
import { section as s08 } from "./s08-odd-charts";
import { section as s09 } from "./s09-missing-data";
import { section as s10 } from "./s10-sources";
import { section as s11 } from "./s11-checks";
import { section as s12 } from "./s12-decisions";
import { section as s13 } from "./s13-glossary";
import { section as s14 } from "./s14-release";

/** Reading order. The rail, the page and the deep links all follow this list. */
export const SECTIONS: SectionContent[] = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12, s13, s14];

export function sectionById(id: string): SectionContent | undefined {
  return SECTIONS.find((s) => s.id === id);
}

/** Finds the section that owns an id, which may be a section or one of its detail blocks. */
export function resolveAnchor(id: string): { section: SectionContent; blockId: string | null } | null {
  const direct = sectionById(id);
  if (direct) return { section: direct, blockId: null };
  for (const s of SECTIONS) {
    if (s.detail.some((b) => b.id === id)) return { section: s, blockId: id };
  }
  return null;
}

export { CANDOUR, DECISIONS, STATUS_LABEL, decisionById, sectionStatus, visibleDecisions, visibleIssues } from "./decisions";
export { GLOSSARY, glossaryById } from "./glossary";
export type { SectionContent, DetailBlock, Decision, DecisionStatus, GlossaryEntry } from "./types";
