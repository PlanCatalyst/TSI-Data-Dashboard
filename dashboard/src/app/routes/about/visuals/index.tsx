import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * The visual for each section. Every visual is its own code-split chunk: the
 * browser downloads and runs it only when the reader scrolls near its section
 * (see AboutSection), not when the About page opens (REQ9.8). The minimum
 * height reserves the space so the page does not jump when it arrives.
 */
type Entry = { Component: LazyExoticComponent<ComponentType>; minHeight: number };

export const VISUALS: Record<string, Entry> = {
  "what-this-is": {
    Component: lazy(() => import("./FrameworkTree").then((m) => ({ default: m.FrameworkTree }))),
    minHeight: 420,
  },
  "reading-a-score": {
    Component: lazy(() => import("./ScoreScale").then((m) => ({ default: m.ScoreScale }))),
    minHeight: 280,
  },
  "source-to-screen": {
    Component: lazy(() => import("./PipelineDiagram").then((m) => ({ default: m.PipelineDiagram }))),
    minHeight: 340,
  },
  scoring: {
    Component: lazy(() => import("./ScoringVisual").then((m) => ({ default: m.ScoringVisual }))),
    minHeight: 760,
  },
  "flat-at-100": {
    Component: lazy(() => import("./FlatAt100").then((m) => ({ default: m.FlatAt100 }))),
    minHeight: 420,
  },
  "choosing-the-number": {
    Component: lazy(() => import("./Sawtooth").then((m) => ({ default: m.Sawtooth }))),
    minHeight: 420,
  },
  pillars: {
    Component: lazy(() => import("./BasketGrid").then((m) => ({ default: m.BasketGrid }))),
    minHeight: 760,
  },
  "odd-charts": {
    Component: lazy(() => import("./OddityGallery").then((m) => ({ default: m.OddityGallery }))),
    minHeight: 1200,
  },
  "missing-data": {
    Component: lazy(() => import("./MissingData").then((m) => ({ default: m.MissingData }))),
    minHeight: 900,
  },
  sources: {
    Component: lazy(() => import("./SourceCards").then((m) => ({ default: m.SourceCards }))),
    minHeight: 420,
  },
  checks: {
    Component: lazy(() => import("./AuditBar").then((m) => ({ default: m.AuditBar }))),
    minHeight: 360,
  },
  decisions: {
    Component: lazy(() => import("./DecisionsLog").then((m) => ({ default: m.DecisionsLog }))),
    minHeight: 360,
  },
  glossary: {
    Component: lazy(() => import("./GlossaryList").then((m) => ({ default: m.GlossaryList }))),
    minHeight: 260,
  },
  release: {
    Component: lazy(() => import("./ReleaseCard").then((m) => ({ default: m.ReleaseCard }))),
    minHeight: 320,
  },
};
