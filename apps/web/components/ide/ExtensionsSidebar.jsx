"use client";

import { useEffect, useState } from "react";

import { listExtensionsCatalog } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function ExtensionsSidebar({ onOpenExtensionsPage }) {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    setLoading(true);
    listExtensionsCatalog(token)
      .then((result) => setItems((result?.extensions || []).slice(0, 12)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="ide-extensions-sidebar">
      <h3>Extensions</h3>
      <button type="button" className="ghost-btn small" onClick={onOpenExtensionsPage}>
        Manage all extensions →
      </button>
      {loading ? <p className="small muted">Loading…</p> : null}
      <ul className="ide-extensions-list">
        {items.map((item) => (
          <li key={item.id || item.extension_id || item.name}>
            <strong>{item.name || item.id}</strong>
            <p className="small muted">{item.description || item.category}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
