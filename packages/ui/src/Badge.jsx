export function Badge({ variant = "primary", className = "", children, ...props }) {
  const variantClass = variant === "warning" ? "cf-badge-warning" : "cf-badge-primary";
  return (
    <span className={`cf-badge ${variantClass} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}
