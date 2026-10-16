import { useLayoutEffect, useRef } from "react";

import { prefersReducedMotion } from "./useMediaQuery";

/**
 * Staggered fade-and-rise for one section, played once when it scrolls into
 * view (REQ9.6). Children marked data-sec-reveal="n" are hidden before first
 * paint, then released in order n with the shared reveal tokens. Does nothing
 * under reduced motion or where IntersectionObserver is missing, so content
 * is never left hidden.
 */
export function useSectionReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-sec-reveal]"));
    items.forEach((el) => {
      el.style.setProperty("--i", String(Number(el.dataset.secReveal) || 0));
      el.classList.add("reveal", "is-armed");
    });
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        requestAnimationFrame(() => items.forEach((el) => el.classList.add("is-in")));
        io.disconnect();
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.02 },
    );
    io.observe(root);
    return () => {
      io.disconnect();
      items.forEach((el) => el.classList.remove("reveal", "is-armed", "is-in"));
    };
  }, []);

  return ref;
}
