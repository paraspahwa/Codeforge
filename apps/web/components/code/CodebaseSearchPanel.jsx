"use client";

import { useState } from "react";

export default function CodebaseSearchPanel({
  sessionId,
  loading,
  onSearchSymbols,
  onSearchKnowledge,
  onOpenFile,
  onInsertMention,
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("symbols");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  async function runSearch() {
    const needle = query.trim();
    if (!needle || !sessionId) {
      return;
    }
    setSearching(true);
    try {
      if (mode === "symbols") {
        const payload = await onSearchSymbols(needle);
        setResults((payload?.matches || []).map((item) => ({ ...item, kind: item.kind || "symbol" })));
      } else {
        const payload = await onSearchKnowledge(needle);
        const chunks = payload?.chunks || payload?.results || [];
        setResults(
          chunks.map((chunk, index) => ({
            id: chunk.id || `chunk-${index}`,
            file: chunk.file || chunk.path || chunk.source || "knowledge",
            line: chunk.line || 1,
            symbol: chunk.title || chunk.text?.slice(0, 80) || needle,
            kind: "knowledge",
            snippet: chunk.text || chunk.content || "",
          })),
        );
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="codebase-search-panel">
      <div className="codebase-search-toolbar">
        <select value={mode} onChange={(event) => setMode(event.target.value)} disabled={loading || searching}>
          <option value="symbols">@symbols</option>
          <option value="codebase">@codebase</option>
        </select>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={mode === "symbols" ? "Search symbols…" : "Ask the codebase…"}
          disabled={loading || searching || !sessionId}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runSearch();
            }
          }}
        />
        <button type="button" className="ghost-btn small" onClick={runSearch} disabled={loading || searching || !query.trim()}>
          {searching ? "…" : "Search"}
        </button>
      </div>
      <ul className="codebase-search-results">
        {results.length === 0 ? (
          <li className="small muted">Search functions, classes, or indexed knowledge.</li>
        ) : (
          results.map((item) => (
            <li key={`${item.file}-${item.line}-${item.symbol}`}>
              <button
                type="button"
                className="codebase-search-hit"
                onClick={() => onOpenFile?.(item.file, item.line)}
                title={item.snippet || item.symbol}
              >
                <span className="codebase-search-symbol">{item.symbol}</span>
                <span className="small muted">
                  {item.file}:{item.line}
                </span>
              </button>
              {onInsertMention ? (
                <button
                  type="button"
                  className="ghost-btn small"
                  onClick={() => onInsertMention(item.file)}
                  title="Add to chat"
                >
                  @
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
