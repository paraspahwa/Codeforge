export function Input({ className = "", ...props }) {
  return <input className={`cf-input ${className}`.trim()} {...props} />;
}

export function Textarea({ className = "", rows = 3, ...props }) {
  return <textarea className={`cf-textarea ${className}`.trim()} rows={rows} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <select className={`cf-select ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}
