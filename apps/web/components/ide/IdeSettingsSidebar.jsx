"use client";

import Link from "next/link";

export default function IdeSettingsSidebar({ ws }) {
  return (
    <div className="ide-settings-sidebar">
      <h3>Settings</h3>

      {ws?.setEditorTheme ? (
        <section className="ide-panel-section">
          <h4 className="ide-panel-section-title">Editor</h4>
          <label className="small ide-settings-field">
            Color theme
            <select
              value={ws.editorTheme || "dark"}
              onChange={(event) => ws.setEditorTheme(event.target.value)}
            >
              <option value="dark">Dark+ (vs-dark)</option>
              <option value="light">Light</option>
            </select>
          </label>
          <p className="small muted">Theme is saved in your browser for this workspace.</p>
        </section>
      ) : null}

      {ws?.localMode ? (
        <section className="ide-panel-section">
          <h4 className="ide-panel-section-title">Workspace</h4>
          <p className="small muted">
            Files are stored locally in your browser. Sign in at{" "}
            <Link href="/login?next=/code">/code</Link> for cloud sessions and agent features.
          </p>
        </section>
      ) : (
        <>
          <h3>Workspace</h3>
          <ul className="ide-settings-links">
            <li>
              <Link href="/settings">Preferences &amp; taste</Link>
            </li>
            <li>
              <Link href="/mcp">MCP servers</Link>
            </li>
            <li>
              <Link href="/agents">Agent catalog</Link>
            </li>
            <li>
              <Link href="/billing">Billing &amp; usage</Link>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
