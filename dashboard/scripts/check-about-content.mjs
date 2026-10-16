// Content guardrail for the About wiki (requirements v2, REQ9.10 to REQ9.12, AC9.7).
// Loads the content modules through Vite (no port is opened), then checks that
// ids are unique, references resolve, the copy follows the writing rules, and
// the methodology table matches the published framework in public/v1/meta.json.
// Run: npm run check:about
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);

const server = await createServer({
  root,
  logLevel: "silent",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});

try {
  const load = (p) => server.ssrLoadModule(p);
  const idx = await load("/src/content/about/index.ts");
  const decisionsMod = await load("/src/content/about/decisions.ts");
  const gloss = await load("/src/content/about/glossary.ts");
  const meth = await load("/src/content/about/methodology.ts");
  const snap = await load("/src/content/about/snapshot.ts");
  const odd = await load("/src/content/about/oddities.ts");
  const src = await load("/src/content/about/sources.ts");
  const s03 = await load("/src/content/about/s03-source-to-screen.ts");
  const s09 = await load("/src/content/about/s09-missing-data.ts");

  const meta = JSON.parse(readFileSync(join(root, "public/v1/meta.json"), "utf8"));
  const countries = JSON.parse(readFileSync(join(root, "public/v1/countries.json"), "utf8"));

  const { SECTIONS } = idx;
  const { DECISIONS, CANDOUR } = decisionsMod;
  const { GLOSSARY } = gloss;

  // ── ids ──────────────────────────────────────────────────────────────────
  const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const seen = new Map();
  const claim = (id, where) => {
    if (!slug.test(id)) fail(`${where}: id "${id}" is not a lowercase slug`);
    if (seen.has(id)) fail(`${where}: id "${id}" already used by ${seen.get(id)}`);
    seen.set(id, where);
  };
  for (const s of SECTIONS) {
    claim(s.id, `section ${s.number}`);
    for (const b of s.detail) claim(b.id, `section ${s.id} block`);
  }
  const numbers = SECTIONS.map((s) => s.number);
  if (numbers.join() !== numbers.map((_, i) => i + 1).join()) fail("section numbers are not 1..n in order");
  const sectionIds = new Set(SECTIONS.map((s) => s.id));

  // ── references ───────────────────────────────────────────────────────────
  const decisionIds = new Set(DECISIONS.map((d) => d.id));
  if (decisionIds.size !== DECISIONS.length) fail("decisions: duplicate id");
  for (const d of DECISIONS) {
    if (!["locked", "pending", "open"].includes(d.status)) fail(`decision ${d.id}: bad status ${d.status}`);
    if (!sectionIds.has(d.section)) fail(`decision ${d.id}: unknown section ${d.section}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) fail(`decision ${d.id}: date must be YYYY-MM-DD`);
  }
  if (!["full", "summarised", "hidden"].includes(CANDOUR)) fail(`CANDOUR is "${CANDOUR}"`);
  for (const s of SECTIONS) {
    for (const id of s.provenance.decisionIds) if (!decisionIds.has(id)) fail(`section ${s.id}: unknown decision ${id}`);
  }
  for (const o of odd.ODDITIES) {
    if (!decisionIds.has(o.decisionId)) fail(`oddity ${o.id}: unknown decision ${o.decisionId}`);
    if (!sectionIds.has(o.section)) fail(`oddity ${o.id}: unknown section ${o.section}`);
  }
  for (const d of snap.AUDIT.defects) if (!decisionIds.has(d.id)) fail(`audit defect ${d.id}: unknown decision`);
  const glossIds = new Set(GLOSSARY.map((g) => g.id));
  for (const g of GLOSSARY) if (g.section && !sectionIds.has(g.section)) fail(`glossary ${g.id}: unknown section ${g.section}`);

  // ── markup tokens in every string ────────────────────────────────────────
  const FACTS = new Set(["countries", "indicators", "pillars", "subdomains", "firstYear", "lastYear"]);
  const strings = [];
  const walk = (v, path) => {
    if (typeof v === "string") strings.push([path, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  walk(SECTIONS, "sections");
  walk(DECISIONS, "decisions");
  walk(GLOSSARY, "glossary");
  walk(odd.ODDITIES, "oddities");
  walk(src.SOURCES, "sources");
  walk(s03.STAGES, "stages");
  walk(s09.GATES, "gates");
  walk(snap.CHANGELOG, "changelog");
  walk(snap.AUDIT, "audit");
  walk(meth.FAMILIES, "families");
  walk(meth.METHODOLOGY, "methodology");

  const blockIds = new Set([...seen.keys()]);
  for (const [path, text] of strings) {
    for (const m of text.matchAll(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/g)) if (!glossIds.has(m[1])) fail(`${path}: unknown glossary term ${m[1]}`);
    for (const m of text.matchAll(/\(\(([a-z0-9-]+)\|[^)]+\)\)/g)) if (!blockIds.has(m[1])) fail(`${path}: unknown section link ${m[1]}`);
    for (const m of text.matchAll(/\{([a-zA-Z]+)\}/g)) if (!FACTS.has(m[1])) fail(`${path}: unknown fact {${m[1]}}`);

    // Writing rules for public copy.
    if (/—/.test(text)) fail(`${path}: em dash`);
    if (/#[0-9a-fA-F]{3,8}\b/.test(text)) fail(`${path}: hex literal`);
    if (text.startsWith("https://")) continue;
    // PlanCatalyst's voice: "we", never "the client", and no process vocabulary in public copy.
    if (/\bclients?\b/i.test(text)) fail(`${path}: says "client", write "we" or name the decision`);
    // Search keywords are not shown, so readers may find a section by words we avoid in copy.
    if (!path.includes(".keywords[") && /\b(pipeline|blocking|reconcil\w*)\b/i.test(text)) fail(`${path}: process vocabulary in public copy`);
    if (/\b(?:src|docs|indicators|dashboard|audit)\/[\w./-]+/.test(text) || /\b[\w-]+\.(?:py|yaml|yml|md|csv|tsx?)\b/.test(text)) fail(`${path}: repository path or file name in public copy`);
  }

  // ── em dashes anywhere in the About source files ─────────────────────────
  const walkFiles = (dir) =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walkFiles(p) : [p];
    });
  for (const dir of ["src/content/about", "src/app/routes/about", "src/hooks"]) {
    for (const f of walkFiles(join(root, dir))) {
      if (/—/.test(readFileSync(f, "utf8"))) fail(`${f.replace(root + "/", "")}: em dash in source`);
    }
  }

  // ── methodology table against the published framework (AC9.7) ───────────
  const metaKeys = meta.indicators.map((i) => i.key);
  const rowKeys = meth.METHODOLOGY.map((r) => r.key);
  for (const k of metaKeys) if (!rowKeys.includes(k)) fail(`methodology: indicator ${k} is in meta.json but not in the table`);
  for (const k of rowKeys) if (!metaKeys.includes(k)) fail(`methodology: row ${k} is not in meta.json`);
  if (new Set(rowKeys).size !== rowKeys.length) fail("methodology: duplicate row");
  const familyIds = new Set(meth.FAMILIES.map((f) => f.id));
  for (const r of meth.METHODOLOGY) {
    if (!familyIds.has(r.family)) fail(`methodology ${r.key}: unknown family ${r.family}`);
    if (r.slider.min >= r.slider.max || r.slider.start < r.slider.min || r.slider.start > r.slider.max) fail(`methodology ${r.key}: bad slider range`);
  }
  for (const k of Object.keys(meth.LABEL_OVERRIDES)) {
    const live = meta.indicators.find((i) => i.key === k);
    if (!live) fail(`label override ${k}: not in meta.json`);
    else if (live.label === meth.LABEL_OVERRIDES[k]) fail(`label override ${k}: meta.json already has this label, remove the override`);
  }
  for (const i of meta.indicators) if (!(i.source in src.META_SOURCE_TO_ID)) fail(`source "${i.source}" (indicator ${i.key}) has no entry in META_SOURCE_TO_ID`);

  // ── sources cover every indicator exactly once ───────────────────────────
  const owner = new Map();
  for (const s of src.SOURCES) {
    for (const k of s.indicators) {
      if (!metaKeys.includes(k)) fail(`source ${s.id}: unknown indicator ${k}`);
      if (owner.has(k)) fail(`indicator ${k} is listed under both ${owner.get(k)} and ${s.id}`);
      owner.set(k, s.id);
    }
    if (!/^https:\/\//.test(s.url)) fail(`source ${s.id}: url must be https`);
  }
  for (const k of metaKeys) if (!owner.has(k)) fail(`indicator ${k} has no source card`);

  // ── gallery examples exist in the contract ───────────────────────────────
  const isos = new Set(countries.map((c) => c.iso3));
  const regionCodes = new Set(meta.regions.map((r) => r.code));
  const pillarKeys = new Set(meta.pillars.map((p) => p.key));
  for (const o of odd.ODDITIES) {
    const v = o.viz;
    if ("iso3" in v && !isos.has(v.iso3)) fail(`oddity ${o.id}: country ${v.iso3} is not in countries.json`);
    if ("indicator" in v && !metaKeys.includes(v.indicator)) fail(`oddity ${o.id}: indicator ${v.indicator} is not in meta.json`);
    if ("pillar" in v && !pillarKeys.has(v.pillar)) fail(`oddity ${o.id}: pillar ${v.pillar} is not in meta.json`);
    if ("region" in v && !regionCodes.has(v.region)) fail(`oddity ${o.id}: region ${v.region} is not in meta.json`);
  }
  if (!isos.has(snap.BRAZIL_CLIMATE.iso3) || !isos.has(snap.TB_RECORD.iso3)) fail("snapshot example country missing from countries.json");

  // ── required parts of every section ──────────────────────────────────────
  for (const s of SECTIONS) {
    if (!s.answer.length) fail(`section ${s.id}: no short answer`);
    if (!s.detail.length) fail(`section ${s.id}: no detail`);
    const words = s.answer.join(" ").split(/\s+/).length;
    if (words > 90) fail(`section ${s.id}: short answer is ${words} words, keep it under 90`);
  }
} finally {
  await server.close();
}

if (errors.length) {
  console.error(`check:about found ${errors.length} problem${errors.length === 1 ? "" : "s"}:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("check:about passed");
