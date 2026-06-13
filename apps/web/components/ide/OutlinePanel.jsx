"use client";

import { useEffect, useState } from "react";

export default function OutlinePanel({ activePath, onSearchSymbols, onOpenAt }) {
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activePath || !onSearchSymbols) {
      setSymbols([]);
      return;
    }
    const base = activePath.split("/").pop()?.replace(/\.[^.]+$/, "") || "";
    if (!base) {
      setSymbols([]);
      return;
    }
    setLoading(true);
    onSearchSymbols(base)
      .then((result) => {
        const matches = (result?.matches || []).filter((item) => item.file === activePath);
        setSymbols(matches.length > 0 ? matches : (result?.matches || []).slice(0, 20));
      })
      .catch(() => setSymbols([]))
      .finally(() => setLoading(false));
  }, [activePath, onSearchSymbols]);

  return (
    <section className="ide-outline-panel">
      <h4 className="ide-panel-section-title">Outline</h4>
      {loading ? <p className="small muted">Loading symbols…</p> : null}
      {!loading && symbols.length === 0 ? <p className="small muted">No symbols for this file.</p> : null}
      <ul className="ide-outline-list">
        {symbols.map((item) => (
          <li key={`${item.file}-${item.line}-${item.symbol}`}>
            <button type="button" className="ide-outline-item" onClick={() => onOpenAt?.(item.file, item.line)}>
              <span className="ide-outline-kind">{item.kind?.[0]?.toUpperCase() || "S"}</span>
              <span>{item.symbol}</span>
              <span className="small muted">:{item.line}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
