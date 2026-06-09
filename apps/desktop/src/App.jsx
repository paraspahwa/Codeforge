import { useState } from "react";
import CodeWorkspace from "./CodeWorkspace";
import CoworkWorkspace from "./CoworkWorkspace";

const MODES = [
  { id: "code", label: "Code" },
  { id: "cowork", label: "Cowork" },
];

export default function App() {
  const [mode, setMode] = useState("code");

  return (
    <div className="desktop-shell">
      <nav className="mode-nav">
        <div className="brand">CodeForge Desktop</div>
        <div className="mode-tabs">
          {MODES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={mode === entry.id ? "mode-tab mode-tab-active" : "mode-tab"}
              onClick={() => setMode(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </nav>
      {mode === "code" ? <CodeWorkspace /> : <CoworkWorkspace />}
    </div>
  );
}
