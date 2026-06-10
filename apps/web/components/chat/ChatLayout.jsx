"use client";

import { useState } from "react";

const MOBILE_VIEWS = [
  { id: "sidebar", label: "Sessions" },
  { id: "chat", label: "Chat" },
  { id: "activity", label: "Activity" },
];

export default function ChatLayout({ sidebar, chat, activity }) {
  const [mobileView, setMobileView] = useState("chat");

  return (
    <div className="chat-layout">
      <div className="chat-mobile-nav" role="tablist" aria-label="Chat panels">
        {MOBILE_VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={mobileView === view.id}
            className={`chat-mobile-tab ${mobileView === view.id ? "chat-mobile-tab-active" : ""}`}
            onClick={() => setMobileView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </div>
      <div className={`chat-col chat-col-sidebar ${mobileView === "sidebar" ? "chat-col-visible" : ""}`}>
        {sidebar}
      </div>
      <div className={`chat-col chat-col-main ${mobileView === "chat" ? "chat-col-visible" : ""}`}>{chat}</div>
      <div className={`chat-col chat-col-activity ${mobileView === "activity" ? "chat-col-visible" : ""}`}>
        {activity}
      </div>
    </div>
  );
}
