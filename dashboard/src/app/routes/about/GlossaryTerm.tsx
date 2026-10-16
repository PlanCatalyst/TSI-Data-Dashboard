import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { glossaryById } from "../../../content/about";

const TIP_WIDTH = 280;

/**
 * A term with a dotted underline that shows its definition on hover, on
 * keyboard focus, and on press (touch). Escape closes it. The tip is shifted
 * left when it would run past the right edge so it never causes page scroll.
 */
export function GlossaryTerm({ id, label }: { id: string; label?: string }) {
  const entry = glossaryById(id);
  const tipId = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [shift, setShift] = useState(0);
  const open = hover || focus || pinned;

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const overflow = rect.left + TIP_WIDTH - (window.innerWidth - 12);
    setShift(overflow > 0 ? -overflow : 0);
  }, [open]);

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(false);
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPinned(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [pinned]);

  if (!entry) return <>{label ?? id}</>;

  return (
    <span
      ref={ref}
      className="gloss"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="gloss-term"
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onClick={() => setPinned((p) => !p)}
      >
        {label ?? entry.term.toLowerCase()}
      </button>
      {open ? (
        <span role="tooltip" id={tipId} className="gloss-tip" style={{ left: shift, width: TIP_WIDTH }}>
          <b>{entry.term}</b>
          <span>{entry.definition}</span>
          {entry.section ? (
            <Link to={`/about/${entry.section}`} className="gloss-more">
              Read more
            </Link>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
