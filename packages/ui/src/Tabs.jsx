"use client";

import { useState } from "react";

export function Tabs({ tabs, defaultTab, onChange, className = "" }) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id);

  function selectTab(id) {
    setActive(id);
    onChange?.(id);
  }

  const current = tabs.find((tab) => tab.id === active) || tabs[0];

  return (
    <div className={className}>
      <div className="cf-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={`cf-tab ${active === tab.id ? "cf-tab-active" : ""}`.trim()}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
