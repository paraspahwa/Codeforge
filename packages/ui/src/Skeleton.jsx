export function Skeleton({ className = "", style, ...props }) {
  return <div className={`cf-skeleton ${className}`.trim()} style={style} aria-hidden="true" {...props} />;
}
