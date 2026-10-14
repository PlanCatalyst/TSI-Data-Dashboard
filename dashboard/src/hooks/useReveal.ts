import { useLayoutEffect, useRef } from "react";

// Staggered fade-and-rise reveal for a region's children (design system,
// section 4). Mark each child with data-reveal; the attribute value is its
// order, which should follow visual hierarchy (title first), not DOM order.
// Children without a value take their DOM index. Re-arms whenever `key`
// changes, so a new country re-reveals the panel. Respects reduced motion by
// doing nothing: the CSS leaves .reveal visible when .is-armed is never set.
export function useReveal<T extends HTMLElement>(key: unknown) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    items.forEach((el, i) => {
      const order = el.dataset.reveal === "" || el.dataset.reveal == null ? i : Number(el.dataset.reveal);
      el.style.setProperty("--i", String(Number.isFinite(order) ? order : i));
      el.classList.remove("is-in");
      el.classList.add("reveal", "is-armed");
    });

    // Two frames: one so the armed state paints, one so the transition runs.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => items.forEach((el) => el.classList.add("is-in")));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [key]);

  return ref;
}
