"use client";

import { useMemo, useState } from "react";

import { buildFileTreeFromPaths, sortTreeChildren } from "../../lib/build-file-tree";

function TreeNode({
  node,
  depth,
  selectedFile,
  expanded,
  onToggle,
  onSelectFile,
  onContextAction,
  loading,
}) {
  const children = sortTreeChildren(node.children);
  const isExpanded = expanded.has(node.path || node.name || "__root__");

  if (node.isFile && node.path) {
    return (
      <button
        type="button"
        className={`code-file-btn tree-file ${selectedFile === node.path ? "code-file-btn-active" : ""}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelectFile(node.path)}
        disabled={loading}
        title={node.path}
        onContextMenu={(event) => {
          event.preventDefault();
          onContextAction?.("menu", node.path);
        }}
      >
        <span className="tree-icon">📄</span>
        {node.name}
      </button>
    );
  }

  const folderKey = node.path || node.name || "__root__";

  return (
    <div className="tree-folder">
      {node.name ? (
        <button
          type="button"
          className="tree-folder-btn"
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => onToggle(folderKey)}
          disabled={loading}
        >
          <span className="tree-icon">{isExpanded ? "📂" : "📁"}</span>
          {node.name}
        </button>
      ) : null}
      {(node.name === "" || isExpanded) &&
        children.map((child) => (
          <TreeNode
            key={child.path || child.name}
            node={child}
            depth={node.name ? depth + 1 : depth}
            selectedFile={selectedFile}
            expanded={expanded}
            onToggle={onToggle}
            onSelectFile={onSelectFile}
            onContextAction={onContextAction}
            loading={loading}
          />
        ))}
    </div>
  );
}

export default function WorkspaceFileTree({
  files,
  changedFiles = [],
  selectedFile,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
  loading,
  showChangedOnly = false,
  onToggleChangedOnly,
}) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(() => new Set(["__root__"]));

  const visibleFiles = useMemo(() => {
    const source = showChangedOnly ? changedFiles.map((item) => item.path || item) : files;
    const needle = filter.trim().toLowerCase();
    if (!needle) {
      return source;
    }
    return source.filter((path) => path.toLowerCase().includes(needle));
  }, [files, changedFiles, filter, showChangedOnly]);

  const tree = useMemo(() => buildFileTreeFromPaths(visibleFiles), [visibleFiles]);

  function toggleFolder(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleContextAction(action, path) {
    if (action === "menu") {
      const choice = window.prompt("File action: create | delete | rename", "create");
      if (!choice) {
        return;
      }
      if (choice === "create") {
        const newPath = window.prompt("New file path (relative)", "src/new-file.ts");
        if (newPath) {
          onCreateFile?.(newPath);
        }
      } else if (choice === "delete") {
        if (window.confirm(`Delete ${path}?`)) {
          onDeleteFile?.(path);
        }
      } else if (choice === "rename") {
        const nextPath = window.prompt("Rename to", path);
        if (nextPath && nextPath !== path) {
          onRenameFile?.(path, nextPath);
        }
      }
    }
  }

  return (
    <div className="workspace-file-tree">
      <div className="workspace-file-tree-toolbar">
        <input
          className="workspace-file-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter files…"
          disabled={loading}
          aria-label="Filter workspace files"
        />
        {onToggleChangedOnly ? (
          <button type="button" className="ghost-btn small" onClick={onToggleChangedOnly} disabled={loading}>
            {showChangedOnly ? "All files" : "Changed only"}
          </button>
        ) : null}
        {onCreateFile ? (
          <button
            type="button"
            className="ghost-btn small"
            disabled={loading}
            onClick={() => {
              const newPath = window.prompt("New file path (relative)", "README.md");
              if (newPath) {
                onCreateFile(newPath);
              }
            }}
          >
            New
          </button>
        ) : null}
      </div>
      <div className="code-file-list workspace-file-list workspace-file-tree-body">
        {visibleFiles.length === 0 ? (
          <p className="small muted">{showChangedOnly ? "No changed files." : "No files found."}</p>
        ) : (
          <TreeNode
            node={tree}
            depth={0}
            selectedFile={selectedFile}
            expanded={expanded}
            onToggle={toggleFolder}
            onSelectFile={onSelectFile}
            onContextAction={handleContextAction}
            loading={loading}
          />
        )}
      </div>
      {!showChangedOnly && files.length > 0 ? (
        <p className="small muted workspace-file-count">{files.length} file(s) in workspace</p>
      ) : null}
    </div>
  );
}
