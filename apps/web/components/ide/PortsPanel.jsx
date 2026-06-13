"use client";

const DEFAULT_PORTS = [
  { port: 3000, label: "Web (Next.js)", url: "http://localhost:3000" },
  { port: 8000, label: "API (FastAPI)", url: "http://localhost:8000" },
  { port: 5432, label: "Postgres", url: null },
  { port: 6379, label: "Redis", url: null },
  { port: 6333, label: "Qdrant", url: "http://localhost:6333" },
];

export default function PortsPanel({ publicHost }) {
  const host = publicHost || "localhost";

  return (
    <div className="ide-ports-panel">
      <p className="small muted">Forwarded ports for this workspace environment.</p>
      <ul className="ide-ports-list">
        {DEFAULT_PORTS.map((item) => {
          const url = item.url?.replace("localhost", host) || null;
          return (
            <li key={item.port}>
              <span className="ide-port-badge">{item.port}</span>
              <span>{item.label}</span>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer" className="small">
                  Open
                </a>
              ) : (
                <span className="small muted">internal</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
