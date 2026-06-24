export function PageHeader({ title, description, actions = null, className = "" }) {
  return (
    <header className={`cf-page-header ${className}`.trim()}>
      <div className="cf-page-header-text">
        <h1>{title}</h1>
        {description ? <p className="small">{description}</p> : null}
      </div>
      {actions ? <div className="cf-page-header-actions">{actions}</div> : null}
    </header>
  );
}
