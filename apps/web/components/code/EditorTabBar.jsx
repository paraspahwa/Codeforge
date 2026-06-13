"use client";

import { useEffect, useRef, useState } from "react";

const MENU_ITEMS = [
  { id: "close", label: "Close" },
  { id: "close-others", label: "Close Others" },
  { id: "close-all", label: "Close All" },
  { id: "split-right", label: "Split Right" },
  { id: "split-down", label: "Split Down" },
  { id: "copy-path", label: "Copy Path" },
];

export default function EditorTabBar({
  tabs,
  activePath,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAll,
  onSplitRight,
  onSplitDown,
  onCopyPath,
}) {
  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function onDocClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenu(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (tabs.length === 0) {
    return (
      <div className="ide-tab-bar ide-tab-bar-empty">
        <span className="small muted">Open a file from the explorer (Ctrl+P)</span>
      </div>
    );
  }

  function runMenuAction(action, path) {
    setMenu(null);
    if (action === "close") {
      onClose(path);
    } else if (action === "close-others") {
      onCloseOthers?.(path);
    } else if (action === "close-all") {
      onCloseAll?.();
    } else if (action === "split-right") {
      onSplitRight?.(path);
    } else if (action === "split-down") {
      onSplitDown?.(path);
    } else if (action === "copy-path") {
      onCopyPath?.(path);
    }
  }

  return (
    <div className="ide-tab-bar" role="tablist">
      {tabs.map((tab) => {
        const name = tab.path.split("/").pop() || tab.path;
        const active = tab.path === activePath;
        return (
          <div
            key={tab.path}
            role="tab"
            aria-selected={active}
            className={`ide-tab ${active ? "ide-tab-active" : ""}`}
            onClick={() => onSelect(tab.path)}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu({ path: tab.path, x: event.clientX, y: event.clientY });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(tab.path);
              }
            }}
            tabIndex={0}
          >
            <span className="ide-tab-label">
              {tab.dirty ? <span className="ide-tab-dot" aria-hidden>●</span> : null}
              {name}
            </span>
            <button
              type="button"
              className="ide-tab-close"
              aria-label={`Close ${name}`}
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.path);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
      {menu ? (
        <ul
          ref={menuRef}
          className="ide-tab-context-menu"
          style={{ top: menu.y, left: menu.x }}
          role="menu"
        >
          {MENU_ITEMS.map((item) => (
            <li key={item.id} role="none">
              <button type="button" role="menuitem" onClick={() => runMenuAction(item.id, menu.path)}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
