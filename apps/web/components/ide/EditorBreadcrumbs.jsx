"use client";

export default function EditorBreadcrumbs({ path, heading }) {
  if (!path) {
    return null;
  }

  const segments = path.split("/").filter(Boolean);

  return (
    <nav className="ide-breadcrumbs" aria-label="Breadcrumb">
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={`${segment}-${index}`} className="ide-breadcrumb-segment">
            {index > 0 ? <span className="ide-breadcrumb-sep">›</span> : null}
            <span className={isLast ? "ide-breadcrumb-active" : ""}>{segment}</span>
          </span>
        );
      })}
      {heading ? (
        <>
          <span className="ide-breadcrumb-sep">›</span>
          <span className="ide-breadcrumb-heading">{heading}</span>
        </>
      ) : null}
    </nav>
  );
}
