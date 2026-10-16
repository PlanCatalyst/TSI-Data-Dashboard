import type { SectionContent } from "./types";

export type Stage = {
  id: string;
  name: string;
  does: string;
  /** What happens to the example record here. Values come from TB_RECORD. */
  record: string;
};

/** The seven stages, in order. `record` follows Brazil, tuberculosis, 2024. */
export const STAGES: Stage[] = [
  {
    id: "fetch",
    name: "Fetch",
    does: "Download the data from each source's public service.",
    record: "The UN database returns 49.0 new tuberculosis cases per 100,000 people for Brazil in 2024.",
  },
  {
    id: "store",
    name: "Raw store",
    does: "Save every file exactly as received, with a fingerprint, so any number can be traced back later.",
    record: "The response is saved byte for byte under the run's id. Nothing has been changed yet.",
  },
  {
    id: "clean",
    name: "Clean",
    does: "Put every source into one shape: country code, year, value.",
    record: "The record becomes BRA, 2024, 49.0, series SH_TBS_INCD.",
  },
  {
    id: "choose",
    name: "Choose the right row",
    does: "Where a source gives several rows for one country and year, keep the national total or the one group the benchmark was written for.",
    record: "This series has no sex, age or area split, so the one row is kept.",
  },
  {
    id: "score",
    name: "Score",
    does: "Compare the value with the indicator's benchmark and convert it to need.",
    record: "The benchmark is 40. Need is 1 minus 40 divided by 49, which is 18.4 on the pipeline's own scale, where higher means more need.",
  },
  {
    id: "check",
    name: "Check",
    does: "Run the validation rules. Any blocking finding ends the run and the previous data stays live.",
    record: "The score is inside 0 to 100, has a source value behind it, and does not alternate. It passes.",
  },
  {
    id: "publish",
    name: "Combine and publish",
    does: "Average into subdomains, pillars and the overall score, flip need into a score where higher is better, and write the three files the dashboard reads.",
    record: "The flip is 100 minus 18.4, which is 81.6. That is the number on the dashboard.",
  },
];

export const section: SectionContent = {
  id: "source-to-screen",
  number: 3,
  title: "From source to screen",
  keywords: ["pipeline", "stages", "fetch", "clean", "publish", "validation", "raw", "trace", "files", "orientation"],
  answer: [
    "Every number passes through seven steps: fetch it from the source, store the raw file, clean it, choose the right row, score it, check it, then combine and publish it.",
    "The dashboard reads only the published files. It never touches anything from the steps in between.",
  ],
  detail: [
    {
      id: "published-files",
      heading: "The three published files",
      body: [
        "Each publish writes three files. One describes the indicators, pillars and years. One holds each country's latest scores. One holds every score for every country, indicator and year. All three join on the [[iso3|ISO3]] country code.",
        "The files are versioned. A change that would break what the dashboard expects moves to a new version path rather than editing the old one.",
      ],
    },
    {
      id: "one-flip",
      heading: "Need is flipped in exactly one place",
      body: [
        "Inside the pipeline, a high score means high need. At the last step, just before publishing, every score is turned around so that higher is better. This happens once and nowhere else, so no chart can show the wrong way up.",
      ],
    },
    {
      id: "all-or-nothing",
      heading: "A bad run never goes live",
      body: [
        "If any blocking check fails, nothing is published and the previous data stays on the dashboard. A run is never published half way. ((checks|How we check the data)) lists the rules.",
      ],
    },
    {
      id: "trace",
      heading: "Tracing a number back",
      body: [
        "Every run has an id, and the raw files it fetched are kept with it. Given a score on screen, the matching raw record can be found and the arithmetic repeated. That is how the independent audit works.",
      ],
    },
  ],
  dashboardLink: { label: "Open the map", to: "/map" },
  provenance: { updated: "2026-10-15", decisionIds: ["no-invented-scores"] },
};
