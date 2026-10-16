import { Link } from "react-router-dom";

import { GLOSSARY } from "../../../../content/about";
import { useWiki } from "../WikiContext";

/** Section 13: every term. The rail filter narrows the list. */
export function GlossaryList() {
  const { query } = useWiki();
  const q = query.trim().toLowerCase();
  const terms = GLOSSARY.filter((g) => !q || g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q));

  return (
    <div className="wiki-viz">
      {terms.length === 0 ? (
        <p className="small">No term matches &ldquo;{query}&rdquo;.</p>
      ) : (
        <dl className="wiki-glossary">
          {terms.map((g) => (
            <div key={g.id} id={`term-${g.id}`}>
              <dt>{g.term}</dt>
              <dd>
                {g.definition}{" "}
                {g.section ? (
                  <Link to={`/about/${g.section}`} className="wiki-xref">
                    Read more
                  </Link>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
