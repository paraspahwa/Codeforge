"use client";

import Link from "next/link";

export default function IdeSettingsSidebar() {
  return (
    <div className="ide-settings-sidebar">
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
    </div>
  );
}
