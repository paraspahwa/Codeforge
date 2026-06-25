"use client";

import { forwardRef, useImperativeHandle, useState } from "react";

const LocalTerminal = forwardRef(function LocalTerminal(
  { files = {}, onRunFile, onAppendOutput },
  ref,
) {
  const [lines, setLines] = useState([
    "CodeForge local terminal (simulated)",
    "Commands: help, clear, ls, cat <path>, run",
  ]);
  const [input, setInput] = useState("");

  useImperativeHandle(ref, () => ({
    writeln(text) {
      setLines((prev) => [...prev, String(text)]);
    },
    clear() {
      setLines([]);
    },
  }));

  function executeCommand(raw) {
    const command = raw.trim();
    if (!command) {
      return;
    }
    setLines((prev) => [...prev, `$ ${command}`]);

    if (command === "clear") {
      setLines([]);
      return;
    }
    if (command === "help") {
      setLines((prev) => [
        ...prev,
        "help — this message",
        "clear — clear terminal",
        "ls — list workspace files",
        "cat <path> — print file contents",
        "run — execute active file in output panel",
      ]);
      return;
    }
    if (command === "ls") {
      setLines((prev) => [...prev, Object.keys(files).sort().join("  ") || "(empty)"]);
      return;
    }
    if (command.startsWith("cat ")) {
      const path = command.slice(4).trim();
      const content = files[path];
      if (content === undefined) {
        setLines((prev) => [...prev, `cat: ${path}: No such file`]);
        return;
      }
      setLines((prev) => [...prev, content]);
      return;
    }
    if (command === "run") {
      onRunFile?.();
      onAppendOutput?.("[terminal] run requested");
      return;
    }
    setLines((prev) => [...prev, `command not found: ${command}`]);
  }

  return (
    <div className="ide-local-terminal">
      <pre className="ide-output-content ide-local-terminal-log">{lines.join("\n")}</pre>
      <form
        className="ide-local-terminal-input"
        onSubmit={(event) => {
          event.preventDefault();
          executeCommand(input);
          setInput("");
        }}
      >
        <span className="ide-local-terminal-prompt">$</span>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Enter command…"
          aria-label="Terminal command"
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </div>
  );
});

export default LocalTerminal;
