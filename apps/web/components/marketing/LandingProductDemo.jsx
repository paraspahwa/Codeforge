"use client";

import { useEffect, useState } from "react";

const SCENES = [
  {
    user: "Build a todo app for my startup",
    agent: "I'll help you plan and build it. Let me explore the workspace and draft a PRD.",
    status: "Exploring agents catalog…",
  },
  {
    user: "Add user auth and Razorpay billing",
    agent: "On it. I'll wire Supabase auth and create the billing flow with INR plans.",
    status: "Drafting implementation plan…",
  },
  {
    user: "Deploy to production on a VPS",
    agent: "Done! Docker compose stack ready. Here's your deploy checklist.",
    status: "Running deploy readiness checks…",
  },
];

export default function LandingProductDemo() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [showTyping, setShowTyping] = useState(true);
  const scene = SCENES[sceneIndex];

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShowTyping(false);
      return undefined;
    }

    const interval = setInterval(() => {
      setShowTyping(true);
      setSceneIndex((current) => (current + 1) % SCENES.length);
      setTimeout(() => setShowTyping(false), 2200);
    }, 4500);

    const typingTimeout = setTimeout(() => setShowTyping(false), 2200);
    return () => {
      clearInterval(interval);
      clearTimeout(typingTimeout);
    };
  }, []);

  return (
    <div className="landing-hero-visual" aria-hidden="true">
      <div className="landing-demo-window landing-glass landing-glow-border">
        <div className="landing-demo-titlebar">
          <div className="landing-demo-dots">
            <span />
            <span />
            <span />
          </div>
          <span className="landing-demo-url">codeforge.app/app</span>
        </div>
        <div className="landing-demo-body">
          <div className="landing-demo-sidebar">
            {[
              { label: "AI partner", active: true },
              { label: "Agents", active: false },
              { label: "Code editor", active: false },
              { label: "Automations", active: false },
            ].map((item) => (
              <div
                key={item.label}
                className={`landing-demo-nav-item ${item.active ? "landing-demo-nav-item--active" : ""}`}
              >
                {item.label}
              </div>
            ))}
          </div>
          <div className="landing-demo-chat">
            <div className="landing-demo-msg landing-demo-msg--user" key={`u-${sceneIndex}`}>
              {scene.user}
            </div>
            <div className="landing-demo-msg landing-demo-msg--agent" key={`a-${sceneIndex}`}>
              {scene.agent}
            </div>
            <div className="landing-demo-msg landing-demo-msg--agent landing-demo-msg--status" key={`s-${sceneIndex}`}>
              {scene.status}
            </div>
            {showTyping ? (
              <div className="landing-demo-typing">
                <span />
                <span />
                <span />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
