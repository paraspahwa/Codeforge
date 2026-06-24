import { Banner } from "./Banner.jsx";

export function StatusBanner({ title, message, variant = "warning", action = null, className = "" }) {
  return (
    <Banner variant={variant} className={`cf-status-banner ${className}`.trim()}>
      <div className="cf-status-banner-inner">
        <div>
          {title ? <strong>{title}</strong> : null}
          {title && message ? " — " : null}
          {message}
        </div>
        {action}
      </div>
    </Banner>
  );
}
