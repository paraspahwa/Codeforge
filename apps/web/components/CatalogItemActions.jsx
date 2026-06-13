"use client";

/**
 * Enable / Disable / Update controls for catalog items (extensions, MCP servers).
 */
export default function CatalogItemActions({
  itemId,
  enabled,
  updateAvailable,
  busyId,
  onEnable,
  onDisable,
  onUpdate,
  enableLabel = "Enable",
  disableLabel = "Disable",
}) {
  const busy = busyId === itemId;

  if (!enabled) {
    return (
      <button type="button" onClick={() => onEnable(itemId)} disabled={busy}>
        {busy ? "Enabling…" : enableLabel}
      </button>
    );
  }

  return (
    <div className="catalog-item-actions">
      <button type="button" className="ghost-btn" onClick={() => onDisable(itemId)} disabled={busy}>
        {busy ? "Disabling…" : disableLabel}
      </button>
      {updateAvailable ? (
        <button type="button" className="btn-update" onClick={() => onUpdate(itemId)} disabled={busy}>
          {busy ? "Updating…" : "Update"}
        </button>
      ) : (
        <button type="button" className="btn-muted" disabled title="Latest catalog version installed">
          Up to date
        </button>
      )}
    </div>
  );
}
