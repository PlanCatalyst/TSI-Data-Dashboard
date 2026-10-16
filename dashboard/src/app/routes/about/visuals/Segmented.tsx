import { useId } from "react";

type Option<T extends string> = { value: T; label: string };

/**
 * A row of mutually exclusive toggle buttons. Arrow keys move between them
 * (radio group semantics) and every state has a visible focus ring.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
}) {
  const id = useId();
  function onKey(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length;
    onChange(options[next].value);
    const btn = document.getElementById(`${id}-${next}`);
    btn?.focus();
  }
  return (
    <div className="wiki-seg" role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.value}
          id={`${id}-${i}`}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          className="wiki-seg-btn"
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
