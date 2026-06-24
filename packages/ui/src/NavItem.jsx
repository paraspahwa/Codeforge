import { Icon } from "./Icon.jsx";

export function NavItem({
  href,
  label,
  hint,
  icon,
  active = false,
  className = "",
  Component = "a",
}) {
  return (
    <Component
      href={href}
      className={`nav-link nav-link-feature ${active ? "nav-link-active" : ""} ${className}`.trim()}
      aria-current={active ? "page" : undefined}
      title={hint}
    >
      <span className="nav-link-icon cf-wiggle-hover">
        <Icon name={icon} size={18} />
      </span>
      <span className="nav-link-text">
        <span className="nav-link-label">{label}</span>
        {hint ? <span className="nav-link-hint small">{hint}</span> : null}
      </span>
    </Component>
  );
}
