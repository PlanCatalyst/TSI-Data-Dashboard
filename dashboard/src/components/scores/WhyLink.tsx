import { Link } from "react-router-dom";

/**
 * "Why?" link from a dashboard oddity to its explanation on the About page
 * (REQ9.9). `to` is an About section id or subsection id. The short note beside
 * it stays as the tooltip; this carries the long-form answer.
 */
export function WhyLink({ to, label = "Why?" }: { to: string; label?: string }) {
  return (
    <Link className="why-link" to={`/about/${to}`}>
      {label}
    </Link>
  );
}
