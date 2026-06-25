"use client";

import { useEffect, useState } from "react";

const SCENES = [
  {
    file: "src/api/routes.ts",
    user: "Add rate limiting to the auth routes",
    agent: "I'll add middleware, update tests, and run the verify loop.",
    status: "Running npm run api:test…",
  },
  {
    file: "apps/web/components/ide/IdeShell.jsx",
    user: "Wire Magic Pointer context into the composer",
    agent: "Binding selection + cursor line. Entity chips will appear in chat.",
    status: "Explored 4 files · 2 searches",
  },
  {
    file: "index.html",
    user: "Run the landing page preview",
    agent: "HTML preview open. Output panel shows console logs from src/index.js.",
    status: "Loop passed · 142 tests green",
  },
];

export default function LandingProductDemo() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const scene = SCENES[sceneIndex];

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      return undefined;
    }
    const interval = setInterval(() => {
      setSceneIndex((current) => (current + 1) % SCENES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mkt-product-frame" aria-hidden="true">
      <div className="mkt-product-chrome">
        <div className="mkt-product-dots">
          <span />
          <span />
          <span />
        </div>
        <span className="mkt-product-url">codeforge.app/code</span>
      </div>
      <div className="mkt-product-layout">
        <aside className="mkt-product-activity">
          {["Explorer", "Search", "Run", "Agents"].map((label, index) => (
            <span key={label} className={index === 0 ? "is-active" : ""} title={label} />
          ))}
        </aside>
        <div className="mkt-product-main">
          <div className="mkt-product-tabs">
            <span className="is-active">{scene.file}</span>
            <span>package.json</span>
          </div>
          <div className="mkt-product-editor">
            <code>
              <span className="kw">export</span> <span className="fn">function</span>{" "}
              <span className="id">createApp</span>() {"{"}
              <br />
              {"  "}
              <span className="cm">// agent edits land here with full repo context</span>
              <br />
              {"}"}
            </code>
          </div>
          <div className="mkt-product-bottom">
            <span>Output</span>
            <span className="is-active">Terminal</span>
            <span>Problems</span>
          </div>
        </div>
        <aside className="mkt-product-composer">
          <p className="mkt-product-composer-label">Composer · Agent</p>
          <div className="mkt-product-msg mkt-product-msg--user">{scene.user}</div>
          <div className="mkt-product-msg mkt-product-msg--agent">{scene.agent}</div>
          <div className="mkt-product-msg mkt-product-msg--status">{scene.status}</div>
        </aside>
      </div>
    </div>
  );
}
