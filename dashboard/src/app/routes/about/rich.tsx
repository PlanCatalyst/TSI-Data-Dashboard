import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { GlossaryTerm } from "./GlossaryTerm";

/** Live facts substituted for {name} in content strings. */
export type Facts = {
  countries: string;
  indicators: string;
  pillars: string;
  subdomains: string;
  firstYear: string;
  lastYear: string;
};

// [[term]] or [[term|label]], ((section|label)), {fact}
const TOKEN = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]|\(\(([a-z0-9-]+)\|([^)]+)\)\)|\{([a-zA-Z]+)\}/g;

/** Resolves the markup used in content strings (see content/about/types.ts). */
export function renderRich(text: string, facts?: Facts): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `r${n++}`;
    if (m[1]) {
      out.push(<GlossaryTerm key={key} id={m[1]} label={m[2]} />);
    } else if (m[3]) {
      out.push(
        <Link key={key} to={`/about/${m[3]}`} className="wiki-xref">
          {m[4]}
        </Link>,
      );
    } else if (m[5]) {
      const fact = facts ? facts[m[5] as keyof Facts] : undefined;
      out.push(<Fragment key={key}>{fact ?? ""}</Fragment>);
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Rich({ text, facts }: { text: string; facts?: Facts }) {
  return <>{renderRich(text, facts)}</>;
}

/** Strips the markup, for filters and aria labels. */
export function plainText(text: string, facts?: Facts): string {
  return text.replace(TOKEN, (_all, term, termLabel, _sec, secLabel, fact) => {
    if (term) return termLabel ?? term;
    if (secLabel) return secLabel;
    return facts ? (facts[fact as keyof Facts] ?? "") : "";
  });
}
