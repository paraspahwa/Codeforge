"use client";

export default function ChatLayout({ sidebar, chat }) {
  return (
    <div className="agent-layout">
      <div className="agent-layout-sidebar">{sidebar}</div>
      <div className="agent-layout-main">{chat}</div>
    </div>
  );
}
