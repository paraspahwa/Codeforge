"use client";

export default function Sparkline({ values = [], maxHeight = 28, className = "" }) {
  if (!values.length) {
    return null;
  }
  const max = Math.max(...values, 1);

  return (
    <div className={`sparkline ${className}`.trim()} aria-hidden="true">
      {values.map((value, index) => (
        <span
          key={`${index}-${value}`}
          className="sparkline-bar"
          style={{ height: `${Math.max(4, (value / max) * maxHeight)}px` }}
        />
      ))}
    </div>
  );
}
