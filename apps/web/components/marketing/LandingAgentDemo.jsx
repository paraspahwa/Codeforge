"use client";

import { useEffect, useState } from "react";

import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

const PROMPT = "Let's build a food delivery app for Tier-2 cities in India";

const STEPS = [
  "Explored agents catalog and MCP tools",
  "Drafted PRD with user stories and INR pricing",
  "Created project plan with auth and Razorpay billing",
  "Generated starter codebase in workspace",
];

const SUMMARY_ITEMS = [
  "Interactive PRD with 12 user stories",
  "Supabase auth + Razorpay checkout wired",
  "Deploy checklist passed — ready for VPS",
];

export default function LandingAgentDemo() {
  const [typedPrompt, setTypedPrompt] = useState("");
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [showTimer, setShowTimer] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(reduced);
    if (reduced) {
      setTypedPrompt(PROMPT);
      setVisibleSteps(STEPS.length);
      setShowTimer(true);
      setShowSummary(true);
      return undefined;
    }

    setAnimating(true);
    let cancelled = false;
    let charIndex = 0;
    let stepIndex = 0;

    const typeInterval = setInterval(() => {
      if (cancelled) {
        return;
      }
      charIndex += 1;
      setTypedPrompt(PROMPT.slice(0, charIndex));
      if (charIndex >= PROMPT.length) {
        clearInterval(typeInterval);
        const stepInterval = setInterval(() => {
          if (cancelled) {
            return;
          }
          stepIndex += 1;
          setVisibleSteps(stepIndex);
          if (stepIndex >= STEPS.length) {
            clearInterval(stepInterval);
            setTimeout(() => {
              if (!cancelled) {
                setShowTimer(true);
                setShowSummary(true);
              }
            }, 400);
          }
        }, 700);
      }
    }, 35);

    return () => {
      cancelled = true;
      clearInterval(typeInterval);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      return undefined;
    }

    const loop = setInterval(() => {
      setTypedPrompt("");
      setVisibleSteps(0);
      setShowTimer(false);
      setShowSummary(false);

      setTimeout(() => {
        let charIndex = 0;
        let stepIndex = 0;
        const typeInterval = setInterval(() => {
          charIndex += 1;
          setTypedPrompt(PROMPT.slice(0, charIndex));
          if (charIndex >= PROMPT.length) {
            clearInterval(typeInterval);
            const stepInterval = setInterval(() => {
              stepIndex += 1;
              setVisibleSteps(stepIndex);
              if (stepIndex >= STEPS.length) {
                clearInterval(stepInterval);
                setTimeout(() => {
                  setShowTimer(true);
                  setShowSummary(true);
                }, 400);
              }
            }, 700);
          }
        }, 35);
      }, 600);
    }, 12000);

    return () => clearInterval(loop);
  }, [reducedMotion]);

  return (
    <section id="demo" className="landing-agent-demo landing-section-block">
      <LandingContainer>
        <ScrollReveal className="landing-section-header">
          <span className="landing-section-eyebrow">Live demo</span>
          <h2>Agents turn ideas into code</h2>
          <p>
            Hand off planning, building, and deployment to CodeForge while you focus on product decisions.
          </p>
        </ScrollReveal>

        <ScrollReveal delayClass="landing-reveal-delay-1">
          <div className="landing-agent-panel landing-glass landing-glow-border">
            <p className="landing-agent-prompt">
              &ldquo;{typedPrompt}
              {!reducedMotion && typedPrompt.length < PROMPT.length ? (
                <span className="landing-typing-cursor" aria-hidden="true" />
              ) : null}
              &rdquo;
            </p>

            <div className="landing-agent-steps">
              {STEPS.map((step, index) => (
                <div
                  key={step}
                  className={`landing-agent-step ${index < visibleSteps ? "is-visible is-done" : ""} ${
                    animating && !reducedMotion && index >= visibleSteps ? "landing-agent-step--pending" : ""
                  }`.trim()}
                >
                  <span className="landing-agent-step-icon">{index < visibleSteps ? "✓" : "·"}</span>
                  {step}
                </div>
              ))}
            </div>

            {showTimer ? (
              <div className="landing-agent-timer">
                <span aria-hidden="true">⏱</span> Worked for 2m 14s
              </div>
            ) : null}

            <div
              className={`landing-agent-summary ${showSummary ? "is-visible" : ""} ${
                animating && !reducedMotion && !showSummary ? "landing-agent-summary--pending" : ""
              }`.trim()}
            >
              <h4>Done! Here&apos;s what we built:</h4>
              <ul>
                {SUMMARY_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollReveal>
      </LandingContainer>
    </section>
  );
}
