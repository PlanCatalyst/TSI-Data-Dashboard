import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { prefersReducedMotion } from "../../hooks/useMediaQuery";

/**
 * Disclosure (design system: "Disclosure"). One drop-down motion for the whole
 * app: the panel eases open downward over --dur-move and nothing beside it moves.
 *
 * DisclosurePanel is the animated region on its own, for headers that have their
 * own layout (a score row, a subdomain header). Disclosure adds the standard header.
 * Height is measured, not animated with grid tracks, because WebKit does not
 * animate those reliably (REQ7.11b). Children mount on first open (REQ9.8) and
 * stay mounted afterwards so their state survives a close.
 */

type PanelProps = {
  open: boolean;
  id?: string;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
};

export function DisclosurePanel({ open, id, labelledBy, className, children }: PanelProps) {
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
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setHeight(0)));
    return () => cancelAnimationFrame(raf);
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
    <div
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      className={className ? `disc-panel ${className}` : "disc-panel"}
      data-open={open}
      style={{ height: height === "auto" ? "auto" : height }}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && open) setHeight("auto");
      }}
    >
      <div ref={inner} className="disc-inner">
        {mounted ? children : null}
      </div>
    </div>
  );
}

type Props = {
  title: ReactNode;
  /** Controlled. Leave out to let the disclosure manage itself. */
  open?: boolean;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
  /** Small text on the right of the header, e.g. a count or a status. */
  meta?: ReactNode;
  /** disc--lg for a section-level drop-down such as "The detail". */
  className?: string;
  /** "div" where a heading would add noise, such as inside a side panel. */
  as?: "h3" | "div";
};

export function Disclosure({ title, open, defaultOpen = false, onToggle, children, meta, className, as = "h3" }: Props) {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const headId = `${uid}-head`;
  const [own, setOwn] = useState(defaultOpen);
  const isOpen = open ?? own;
  const Heading = as;

  return (
    <div className={className ? `disc ${className}` : "disc"} data-open={isOpen}>
      <Heading className="disc-title" id={headId}>
        <button
          type="button"
          className="disc-btn"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => {
            setOwn(!isOpen);
            onToggle?.(!isOpen);
          }}
        >
          <span className="disc-label">{title}</span>
          {meta ? <span className="disc-meta">{meta}</span> : null}
          <span className="disc-icon" aria-hidden="true" />
        </button>
      </Heading>
      <DisclosurePanel open={isOpen} id={panelId} labelledBy={headId}>
        {children}
      </DisclosurePanel>
    </div>
  );
}
