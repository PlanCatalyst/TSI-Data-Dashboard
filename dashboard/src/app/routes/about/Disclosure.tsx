import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { prefersReducedMotion } from "../../../hooks/useMediaQuery";

type Props = {
  title: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
  /** Small text on the right of the header, e.g. a count. */
  meta?: ReactNode;
};

/**
 * Collapsible region. Height animates over --dur-move with --ease-move by
 * measuring the content, not by animating grid tracks (WebKit does not animate
 * them reliably, REQ7.11b). Children are not mounted until first opened
 * (REQ9.8) and stay mounted afterwards so their state survives a close.
 */
export function Disclosure({ title, open, onToggle, children, meta }: Props) {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const headId = `${uid}-head`;
  const inner = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [height, setHeight] = useState<number | "auto">(open ? "auto" : 0);
  const prevOpen = useRef(open);
  const pendingOpen = useRef(false);

  // React to open or close. Opening first mounts the children, then measures them.
  useLayoutEffect(() => {
    if (prevOpen.current === open) return;
    prevOpen.current = open;
    if (open) {
      pendingOpen.current = true;
      setMounted(true);
      return;
    }
    const el = inner.current;
    if (!el || prefersReducedMotion()) {
      setHeight(0);
      return;
    }
    setHeight(el.scrollHeight);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setHeight(0)));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useLayoutEffect(() => {
    if (!pendingOpen.current || !mounted) return;
    pendingOpen.current = false;
    const el = inner.current;
    if (!el || prefersReducedMotion()) {
      setHeight("auto");
      return;
    }
    setHeight(el.scrollHeight);
  }, [mounted, open]);

  return (
    <div className="wdisc" data-open={open}>
      <h3 className="wdisc-title" id={headId}>
        <button
          type="button"
          className="wdisc-btn"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onToggle(!open)}
        >
          <span>{title}</span>
          {meta ? <span className="wdisc-meta">{meta}</span> : null}
          <span className="wdisc-icon" aria-hidden="true" />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headId}
        className="wdisc-panel"
        style={{ height: height === "auto" ? "auto" : height }}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && open) setHeight("auto");
        }}
      >
        <div ref={inner} className="wdisc-inner">
          {mounted ? children : null}
        </div>
      </div>
    </div>
  );
}
