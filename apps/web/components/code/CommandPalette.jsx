"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function CommandPalette({ open, commands, onClose, onRun }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return commands;
    }
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(needle) ||
        (cmd.hint || "").toLowerCase().includes(needle),
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

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
      <div className="ide-palette" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          className="ide-palette-input"
          placeholder="Type a command…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && filtered[0]) {
              event.preventDefault();
              onRun(filtered[0]);
              onClose();
            }
          }}
        />
        <ul className="ide-palette-list">
          {filtered.map((cmd) => (
            <li key={cmd.id}>
              <button type="button" className="ide-palette-item" onClick={() => { onRun(cmd); onClose(); }}>
                <span>{cmd.label}</span>
                {cmd.shortcut ? <kbd className="ide-kbd">{cmd.shortcut}</kbd> : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? <li className="small muted ide-palette-empty">No matching commands</li> : null}
        </ul>
      </div>
    </div>
  );
}
