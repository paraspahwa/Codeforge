export function Panel({ className = "", children, ...props }) {
  return (
    <section className={`cf-panel ${className}`.trim()} {...props}>
      {children}
    </section>
  );
}

export function Card({ className = "", children, ...props }) {
  return (
    <div className={`cf-card ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function Divider() {
  return <hr className="cf-divider" />;
}
