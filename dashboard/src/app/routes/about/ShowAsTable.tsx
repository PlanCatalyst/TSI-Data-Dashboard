import { useId, useState, type ReactNode } from "react";

type Props = {
  caption: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
  /** Shown beside the toggle, e.g. a snapshot note. */
  note?: ReactNode;
};

/**
 * Text equivalent for a visual (REQ9.7): the numbers behind it, as a real
 * table, one press away and reachable by keyboard.
 */
export function ShowAsTable({ caption, columns, rows, note }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="wiki-astable">
      <div className="wiki-astable-bar">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide table" : "Show as table"}
        </button>
        {note ? <span className="small">{note}</span> : null}
      </div>
      {open ? (
        <div id={id} className="wiki-tablewrap" tabIndex={0} role="region" aria-label={caption}>
          <table className="wiki-table">
            <caption>{caption}</caption>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j} className={typeof cell === "number" ? "num" : undefined}>
                      {cell === null ? "no data" : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
