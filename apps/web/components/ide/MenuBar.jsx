"use client";

import { useEffect, useState } from "react";

const MENUS = [
  {
    id: "file",
    label: "File",
    items: [
      { id: "quick-open", label: "Quick open…", shortcut: "Ctrl+P" },
      { id: "new-file", label: "New file" },
      { id: "save", label: "Save", shortcut: "Ctrl+S" },
      { id: "save-all", label: "Save all" },
      { id: "close-tab", label: "Close editor" },
      { id: "close-all", label: "Close all editors" },
    ],
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      { id: "inline-edit", label: "Inline edit", shortcut: "Ctrl+K" },
      { id: "toggle-wrap", label: "Toggle word wrap" },
      { id: "format", label: "Format document", shortcut: "Shift+Alt+F" },
      { id: "split-right", label: "Split editor right" },
      { id: "split-down", label: "Split editor down" },
      { id: "close-split", label: "Close split editor" },
    ],
  },
  {
    id: "view",
    label: "View",
    items: [
      { id: "command-palette", label: "Command palette…", shortcut: "Ctrl+Shift+P" },
      { id: "toggle-explorer", label: "Explorer" },
      { id: "toggle-search", label: "Search" },
      { id: "toggle-scm", label: "Source control" },
      { id: "toggle-sidebar", label: "Toggle sidebar" },
      { id: "toggle-terminal", label: "Toggle terminal" },
      { id: "toggle-composer", label: "Toggle Composer" },
      { id: "toggle-minimap", label: "Toggle minimap" },
      { id: "problems", label: "Problems panel" },
      { id: "zen", label: "Zen mode" },
    ],
  },
  {
    id: "go",
    label: "Go",
    items: [
      { id: "go-definition", label: "Go to definition", shortcut: "F12" },
      { id: "find-references", label: "Find references", shortcut: "Shift+F12" },
    ],
  },
  {
    id: "run",
    label: "Run",
    items: [
      { id: "run-shell", label: "Run terminal command" },
      { id: "agent-loop", label: "Run verify loop" },
      { id: "toggle-run", label: "Run and Debug sidebar" },
    ],
  },
  {
    id: "terminal",
    label: "Terminal",
    items: [
      { id: "new-terminal", label: "Focus terminal" },
      { id: "toggle-terminal", label: "Toggle terminal panel" },
    ],
  },
  {
    id: "help",
    label: "Help",
    items: [{ id: "shortcuts", label: "Keyboard shortcuts" }],
  },
];

export default function MenuBar({ onRunCommand }) {
  const [openMenu, setOpenMenu] = useState(null);

  useEffect(() => {
    function onDocumentClick(event) {
      if (!event.target.closest(".ide-menu-group")) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  return (
    <nav className="ide-menu-bar" aria-label="Application menu">
      {MENUS.map((menu) => (
        <div key={menu.id} className="ide-menu-group">
          <button
            type="button"
            className={`ide-menu-trigger ${openMenu === menu.id ? "ide-menu-trigger-open" : ""}`}
            onClick={() => setOpenMenu((current) => (current === menu.id ? null : menu.id))}
          >
            {menu.label}
          </button>
          {openMenu === menu.id ? (
            <ul className="ide-menu-dropdown" role="menu">
              {menu.items.map((item) => (
                <li key={item.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="ide-menu-item"
                    onClick={() => {
                      onRunCommand(item.id);
                      setOpenMenu(null);
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut ? <span className="ide-menu-shortcut">{item.shortcut}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </nav>
  );
}
