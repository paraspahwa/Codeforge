"use client";

import { useState } from "react";

export default function WorkspaceSearchPanel({ sessionId, loading, onSearch, onOpenFile, onOpenAt }) {
  const [query, setQuery] = useState("");
  const [pathHits, setPathHits] = useState([]);
  const [contentHits, setContentHits] = useState([]);
  const [searching, setSearching] = useState(false);

  async function runSearch() {
    const needle = query.trim();
    if (!needle || !sessionId) {
      return;
    }
    setSearching(true);
    try {
      const result = await onSearch(needle);
      setPathHits(result?.path_hits || []);
      setContentHits(result?.content_hits || []);
    } catch {
      setPathHits([]);
      setContentHits([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="ide-workspace-search">
      <h3>Search</h3>
      <div className="codebase-search-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search files and content (Ctrl+Shift+F)"
          disabled={loading || searching || !sessionId}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runSearch();
            }
          }}
        />
        <button type="button" className="ghost-btn small" onClick={runSearch} disabled={loading || searching}>
          Search
        </button>
      </div>
      {pathHits.length > 0 ? (
        <section>
          <h4 className="ide-panel-section-title">Files ({pathHits.length})</h4>
          <ul className="codebase-search-results">
            {pathHits.map((path) => (
              <li key={path}>
                <button type="button" className="codebase-search-hit" onClick={() => onOpenFile(path)}>
                  {path}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {contentHits.length > 0 ? (
        <section>
          <h4 className="ide-panel-section-title">Results ({contentHits.length})</h4>
          <ul className="codebase-search-results">
            {contentHits.map((hit) => (
              <li key={`${hit.path}-${hit.line}`}>
                <button
                  type="button"
                  className="codebase-search-hit"
                  onClick={() => onOpenAt?.(hit.path, hit.line)}
                  title={hit.text}
                >
                  <span className="codebase-search-symbol">
                    {hit.path}:{hit.line}
                  </span>
                  <span className="small muted">{hit.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
