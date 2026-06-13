"use client";

const CAPTIONS = {
  idle: "Ready to code!",
  thinking: "Thinking…",
  coding: "Writing code…",
  celebrating: "Done!",
};

export default function AgentMascot({ state = "idle" }) {
  const caption = CAPTIONS[state] || CAPTIONS.idle;

  return (
    <div className={`agent-mascot agent-mascot-${state}`} aria-hidden>
      <div className="mascot-scene">
        <div className="mascot-body">
          <div className="mascot-antenna" />
          <div className="mascot-face">
            <span className="mascot-eye mascot-eye-left" />
            <span className="mascot-eye mascot-eye-right" />
            <span className="mascot-mouth" />
          </div>
          <div className="mascot-torso">
            <span className="mascot-core" />
          </div>
          <div className="mascot-arms">
            <span className="mascot-arm mascot-arm-left" />
            <span className="mascot-arm mascot-arm-right" />
          </div>
          <div className="mascot-legs">
            <span className="mascot-leg mascot-leg-left" />
            <span className="mascot-leg mascot-leg-right" />
          </div>
        </div>
        {state === "coding" ? (
          <div className="mascot-code-bits">
            <span>{"{ }"}</span>
            <span>{"</>"}</span>
            <span>{"();"}</span>
          </div>
        ) : null}
        {state === "celebrating" ? <div className="mascot-sparkles">✦ ✧ ✦</div> : null}
      </div>
      <p className="mascot-caption small">{caption}</p>
    </div>
  );
}
