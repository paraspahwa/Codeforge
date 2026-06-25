"use client";

/**
 * Action chips for Magic Pointer detected entities.
 */
export default function MagicPointerChips({ entities = [], onAction, disabled }) {
  if (!entities?.length) {
    return null;
  }

  return (
    <div className="magic-pointer-chips" aria-label="Suggested actions for code under cursor">
      {entities.map((entity) => (
        <button
          key={`${entity.kind}-${entity.value}`}
          type="button"
          className="magic-pointer-chip"
          disabled={disabled}
          onClick={() => onAction?.(entity)}
          title={(entity.suggested_actions || []).join(" · ")}
        >
          <span className="magic-pointer-chip-kind">{entity.kind.replace(/_/g, " ")}</span>
          <span className="magic-pointer-chip-value">{entity.value}</span>
        </button>
      ))}
    </div>
  );
}
