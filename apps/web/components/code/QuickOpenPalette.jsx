"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function QuickOpenPalette({ open, files, initialQuery = "", onClose, onOpen }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const ranked = files
      .map((path) => {
        const lower = path.toLowerCase();
        const base = path.split("/").pop()?.toLowerCase() || lower;
        let score = 0;
        if (!needle) {
          score = 1;
        } else if (base.startsWith(needle)) {
          score = 100;
        } else if (base.includes(needle)) {
          score = 60;
        } else if (lower.includes(needle)) {
          score = 30;
        } else {
          return null;
        }
        return { path, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    return ranked.slice(0, 40).map((item) => item.path);
  }, [files, query]);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery || "");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, initialQuery]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKey(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="ide-overlay" onClick={onClose} role="presentation">
      <div className="ide-palette" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Quick open">
        <input
          ref={inputRef}
          className="ide-palette-input"
          placeholder="Search files by name…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && filtered[0]) {
              event.preventDefault();
              onOpen(filtered[0]);
              onClose();
            }
          }}
        />
        <ul className="ide-palette-list">
          {filtered.map((path) => (
            <li key={path}>
              <button type="button" className="ide-palette-item" onClick={() => { onOpen(path); onClose(); }}>
                <span>{path}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 ? <li className="small muted ide-palette-empty">No files match</li> : null}
        </ul>
      </div>
    </div>
  );
}
