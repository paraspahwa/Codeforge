"use client";

import { useEffect, useState } from "react";

import { BUILD_JOURNEY } from "../../lib/product-features";
import { getBuildJourneyState } from "../../lib/build-journey";

export default function BuildJourneyProgress() {
  const [state, setState] = useState({ currentStep: 1, completed: [] });

  useEffect(() => {
    setState(getBuildJourneyState());
    function onChange(event) {
      setState(event.detail || getBuildJourneyState());
    }
    window.addEventListener("codeforge:journey-change", onChange);
    return () => window.removeEventListener("codeforge:journey-change", onChange);
  }, []);

  const completed = new Set(state.completed);

  return (
    <div className="build-journey-progress" aria-label="Build journey progress">
      <p className="quick-start-label">Step {state.currentStep} of 5</p>
      <div className="build-journey-progress-track">
        {BUILD_JOURNEY.map((step) => {
          const done = completed.has(step.step) || step.step < state.currentStep;
          const active = step.step === state.currentStep;
          return (
            <div
              key={step.step}
              className={`build-journey-progress-step ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}
              title={step.title}
            >
              <span className="build-journey-progress-dot" style={{ "--step-color": step.color }}>
                {done ? "✓" : step.icon}
              </span>
              <span className="small">{step.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
