export function EmptyState({ title, description, action }) {
  return (
    <div className="cf-empty">
      {title ? <h3>{title}</h3> : null}
      {description ? <p className="small">{description}</p> : null}
      {action ? <div style={{ marginTop: "1rem" }}>{action}</div> : null}
    </div>
  );
}
