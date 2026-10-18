/**
 * Shapes for the About wiki content (requirements v2, section 9).
 *
 * Copy lives in this folder, one module per section, so text changes never
 * touch components (REQ9.10). Strings may carry three kinds of markup, all
 * resolved by app/routes/about/rich.tsx:
 *
 *   [[basket]] or [[basket|basket rule]]   glossary term with a hover definition
 *   ((scoring|how scores work))            link to another About section
 *   {countries}                            live fact from the loaded contract
 */

/** Locked: decided and shipped. Pending: decision not made yet. Open: known, not decided. */
export type DecisionStatus = "locked" | "pending" | "open";

export type DetailBlock = {
  /** Stable id, also the deep link target: #/about/<id>. */
  id: string;
  heading: string;
  body: string[];
};

export type DashboardLink = {
  label: string;
  /** In-app route, e.g. "/explore". */
  to: string;
};

export type SectionContent = {
  /** Stable id, also the deep link target: #/about/<id>. */
  id: string;
  number: number;
  title: string;
  /** Extra words the rail filter matches besides the title. */
  keywords: string[];
  /** Two or three sentences, always visible. */
  answer: string[];
  /** Behind "The detail". Each block is a subsection in the rail. */
  detail: DetailBlock[];
  dashboardLink?: DashboardLink;
  provenance: {
    /** Last time the section text was checked against the pipeline. */
    updated: string;
    /** Decisions this section rests on; its status chip comes from them. */
    decisionIds: string[];
  };
};

export type Decision = {
  id: string;
  title: string;
  /** What had to be settled. */
  consideration: string;
  /** What the dashboard does. */
  decision: string;
  why: string;
  date: string;
  status: DecisionStatus;
  /** Internal issue ids. Shown only when CANDOUR is "full". */
  issues: string[];
  /** Section that explains it. */
  section: string;
};

export type GlossaryEntry = {
  id: string;
  term: string;
  definition: string;
  /** Section that explains it in full. */
  section?: string;
};
