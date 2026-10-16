// Component guardrail (design system, requirements v2 REQ7.2 extended).
//
// lint:tokens stops stray colours and radii. This stops stray CONTROLS: a new
// button style, or a second version of a component the design system already
// has. It reads every <button> (and role="button") in dashboard/src and checks
// that each class on it belongs to a component registered in
// scripts/component-registry.json, and that every registered component is
// documented on docs/design-system/index.html.
//
//   allowed  components in the design system: class names, with the specimen to find on the page
//   legacy   controls that exist today but are not yet in the design system. This list
//            may only shrink: a class that is no longer used must be removed.
//   banned   classes retired in favour of a design system component
//   bareButtonsMax  buttons with no class at all, a ceiling that may only go down
//
// To add a control: add it to the design system page first, then to "allowed" here.
// Run: npm run lint:components        List what is used today: npm run lint:components -- --list
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const registry = JSON.parse(readFileSync(join(root, "scripts/component-registry.json"), "utf8"));
const designSystem = readFileSync(resolve(root, "..", registry.designSystemPage), "utf8");

const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

/** Reads one JSX opening tag starting at `<`, honouring braces and quotes, and returns its attribute text. */
function openingTag(text, start) {
  let depth = 0;
  let quote = "";
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== "\\") quote = "";
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}

const used = new Map(); // class -> [files]
let bare = [];
const files = walk(src).filter((p) => p.endsWith(".tsx"));
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const rel = relative(root, f);
  for (const m of text.matchAll(/<button\b|<[A-Za-z.]+\b[^>]*role="button"/g)) {
    const tag = openingTag(text, m.index);
    const cn = tag.match(/className=(?:"([^"]*)"|\{([\s\S]*?)\}(?=\s|>|\/))/);
    if (!cn) {
      bare.push(rel);
      continue;
    }
    const literals = cn[1] !== undefined ? [cn[1]] : [...cn[2].matchAll(/["'`]([^"'`$]*)["'`]/g)].map((x) => x[1]);
    for (const lit of literals) {
      for (const cls of lit.split(/\s+/).filter(Boolean)) {
        if (!used.has(cls)) used.set(cls, new Set());
        used.get(cls).add(rel);
      }
    }
  }
}

if (process.argv.includes("--list")) {
  console.log(`buttons with no className: ${bare.length}`);
  for (const [cls, where] of [...used].sort()) console.log(cls.padEnd(24), [...where].join(", "));
  process.exit(0);
}

const errors = [];
const allowed = new Set(Object.values(registry.allowed).flatMap((c) => c.classes));
const legacy = new Set(Object.keys(registry.legacy));
const banned = new Set(registry.banned);

for (const [cls, where] of used) {
  if (banned.has(cls)) errors.push(`banned class "${cls}" on a button in ${[...where].join(", ")}: use ${registry.bannedUse[cls] ?? "the design system component"}`);
  else if (!allowed.has(cls) && !legacy.has(cls))
    errors.push(`unregistered button class "${cls}" in ${[...where].join(", ")}: use a design system component, or add the control to docs/design-system/index.html and then to scripts/component-registry.json`);
}
for (const cls of legacy) if (!used.has(cls)) errors.push(`legacy class "${cls}" is no longer used: remove it from scripts/component-registry.json`);
if (bare.length > registry.bareButtonsMax) errors.push(`${bare.length} buttons have no className (ceiling ${registry.bareButtonsMax}): give them a design system component. In: ${[...new Set(bare)].join(", ")}`);
if (bare.length < registry.bareButtonsMax) errors.push(`only ${bare.length} buttons have no className: lower bareButtonsMax from ${registry.bareButtonsMax} in scripts/component-registry.json`);

// Banned classes must not survive in any stylesheet or other markup either.
for (const f of walk(src).filter((p) => /\.(css|tsx|ts)$/.test(p))) {
  const text = readFileSync(f, "utf8");
  for (const b of banned) {
    if (new RegExp(`(^|[^\\w-])\\.?${b}($|[^\\w-])`).test(text)) errors.push(`banned class "${b}" still appears in ${relative(root, f)}`);
  }
}

// Every registered component has a specimen on the design system page.
for (const [name, c] of Object.entries(registry.allowed)) {
  if (!designSystem.includes(c.specimen)) errors.push(`design system page has no specimen for "${name}" (looked for ${c.specimen})`);
  for (const cls of c.classes) if (!new RegExp(`class="[^"]*\\b${cls}\\b`).test(designSystem) && !designSystem.includes(`.${cls}`)) errors.push(`design system page never mentions class "${cls}" (${name})`);
}

if (errors.length) {
  console.error(`lint:components found ${errors.length} problem${errors.length === 1 ? "" : "s"}:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`lint:components passed (${used.size} button classes, ${legacy.size} legacy, ${bare.length} bare)`);
