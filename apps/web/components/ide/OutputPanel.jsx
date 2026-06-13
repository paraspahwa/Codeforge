"use client";

import { useEffect, useRef } from "react";

export default function OutputPanel({ lines, onClear }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="ide-output-panel">
      <div className="ide-output-toolbar">
        <button type="button" className="ghost-btn small" onClick={onClear}>
          Clear
        </button>
      </div>
      <pre ref={ref} className="ide-output-content">
        {lines.length === 0 ? "Output from agent runs, git, and shell commands appears here." : lines.join("\n")}
      </pre>
    </div>
  );
}
