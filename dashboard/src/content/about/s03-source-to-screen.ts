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
    does: "We download the data from each source's public service.",
    record: "The UN database returns 49.0 new tuberculosis cases per 100,000 people for Brazil in 2024.",
  },
  {
    id: "store",
    name: "Raw store",
    does: "We save every file exactly as we received it, with a fingerprint, so any number can be traced back.",
    record: "We save the response exactly as received, under that update's id. Nothing has been changed yet.",
  },
  {
    id: "clean",
    name: "Clean",
    does: "We put every source into one shape: country code, year, value.",
    record: "The record becomes BRA, 2024, 49.0, series SH_TBS_INCD.",
  },
  {
    id: "choose",
    name: "Choose the right row",
    does: "Where a source gives several rows for one country and year, we keep the national total or the one group the benchmark was written for.",
    record: "This series has no sex, age or area split, so the one row is kept.",
  },
  {
    id: "score",
    name: "Score",
    does: "We compare the value with the indicator's benchmark and turn it into a measure of need.",
    record: "The benchmark is 40. Need is 1 minus 40 divided by 49, which is 18.4 on our working scale, where higher means more need.",
  },
  {
    id: "check",
    name: "Check",
    does: "We run our checks. If a serious one fails, we stop and the previous data stays live.",
    record: "The score is inside 0 to 100, has a source value behind it, and does not jump up and down. It passes.",
  },
  {
    id: "publish",
    name: "Combine and publish",
    does: "We average into subdomains, pillars and the overall score, turn need into a score where higher is better, and write the three files the dashboard reads.",
    record: "The flip is 100 minus 18.4, which is 81.6. That is the number on the dashboard.",
  },
];

export const section: SectionContent = {
  id: "source-to-screen",
  number: 3,
  title: "How the data gets here",
  keywords: ["pipeline", "stages", "fetch", "clean", "publish", "validation", "raw", "trace", "files", "orientation"],
  answer: [
    "Every number goes through seven steps. We fetch it from the source, store the raw file, clean it, choose the right row, score it, check it, then combine and publish it.",
    "The dashboard shows only what we publish. It never reads anything from the steps in between.",
  ],
  detail: [
    {
      id: "published-files",
      heading: "The three files behind the dashboard",
      body: [
        "Each time we publish, we write three files. One describes the indicators, pillars and years. One holds each country's latest scores. One holds every score for every country, indicator and year. All three match countries by their [[iso3|ISO3]] code.",
        "We version the files. If a change would break what the dashboard expects, it moves to a new version instead of editing the old one.",
      ],
    },
    {
      id: "one-flip",
      heading: "Why higher means better",
      body: [
        "While we calculate, a high score means high need. At the very last step, just before publishing, we turn every score around so that higher is better. We do this once and nowhere else, so no chart can show the wrong way up.",
      ],
    },
    {
      id: "all-or-nothing",
      heading: "If a check fails",
      body: [
        "If a check fails, we do not publish. The last good data stays on the dashboard, and we never publish half an update. ((checks|How we check the data)) lists what we look for.",
      ],
    },
    {
      id: "trace",
      heading: "Tracing a number back",
      body: [
        "Every update has an id, and we keep the raw files it fetched. For any score on screen, we can find the matching raw record and repeat the arithmetic. That is how the independent check works.",
      ],
    },
  ],
  dashboardLink: { label: "Open the map", to: "/map" },
  provenance: { updated: "2026-10-15", decisionIds: ["no-invented-scores"] },
};
