import { NavLink } from "react-router-dom";
import { PropsWithChildren } from "react";

const links = [
  { to: "/map", label: "Map" },
  { to: "/explore", label: "Explore" },
  { to: "/compare", label: "Compare" },
  { to: "/about", label: "About" },
];

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="brand">PlanCatalyst Dashboard</h1>
        <nav className="main-nav" aria-label="Main navigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}
