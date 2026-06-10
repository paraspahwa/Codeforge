export function Button({ variant = "primary", className = "", type = "button", ...props }) {
  const variantClass =
    variant === "ghost" ? "cf-btn-ghost" : variant === "danger" ? "cf-btn-danger" : "cf-btn-primary";
  return <button type={type} className={`cf-btn ${variantClass} ${className}`.trim()} {...props} />;
}

export function IconButton({ className = "", ...props }) {
  return <button type="button" className={`cf-btn cf-btn-ghost ${className}`.trim()} {...props} />;
}
