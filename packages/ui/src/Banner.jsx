export function Banner({ children, variant = "default", className = "" }) {
  const variantClass = variant === "warning" ? "cf-banner-warning" : variant === "info" ? "cf-banner-info" : "";
  return (
    <div className={`cf-banner ${variantClass} ${className}`.trim()} role="status">
      {children}
    </div>
  );
}
