"use client";

import { Button } from "@codeforge/ui";

export default function WorkflowDrawer({
  showWorkflows,
  onToggle,
  sessionId,
  loading,
  sessionWritable,
  loopVerify,
  onLoopVerifyChange,
  loopPrompt,
  onLoopPromptChange,
  loopMaxAttempts,
  onLoopMaxAttemptsChange,
  loopRunning,
  onRunLoop,
  planTargets,
  onPlanTargetsChange,
  autoMode,
  onAutoModeChange,
  onCompact,
  onUltrareview,
  onFork,
  onCreatePlan,
  onExecutePlan,
  onRollbackPlan,
  activePlanId,
  workflowOutput,
  templateName,
  onTemplateNameChange,
  templatePrefix,
  onTemplatePrefixChange,
  onCreateTemplate,
  templates,
  onRunTemplate,
  selectedTemplateId,
}) {
  return (
    <>
      <button type="button" className="ghost-btn" onClick={onToggle}>
        {showWorkflows ? "Hide" : "Show"} Advanced Workflows
      </button>
      {showWorkflows ? (
        <div className="mt-8">
          <div className="replay-toolbar">
            <Button type="button" variant="ghost" onClick={onCompact} disabled={!sessionId || loading || !sessionWritable}>
              Compact
            </Button>
            <Button type="button" variant="ghost" onClick={onUltrareview} disabled={!sessionId || loading || !sessionWritable}>
              Ultrareview
            </Button>
            <Button type="button" variant="ghost" onClick={onFork} disabled={!sessionId || loading || !sessionWritable}>
              Fork Session
            </Button>
          </div>
          <h4 className="small mt-8">Verify / fix loop</h4>
          <input
            value={loopVerify}
            onChange={(event) => onLoopVerifyChange(event.target.value)}
            disabled={loading || loopRunning}
            placeholder="auto from .codeforge/loop-engineering.yaml"
          />
          <textarea
            rows={2}
            value={loopPrompt}
            onChange={(event) => onLoopPromptChange(event.target.value)}
            disabled={loading || loopRunning}
          />
          <input
            type="number"
            min={1}
            max={10}
            value={loopMaxAttempts}
            onChange={(event) => onLoopMaxAttemptsChange(event.target.value)}
            disabled={loading || loopRunning}
          />
          <Button
            type="button"
            onClick={onRunLoop}
            disabled={!sessionId || loading || loopRunning || !sessionWritable}
          >
            {loopRunning ? "Loop running…" : "Run Loop"}
          </Button>
          <input
            value={planTargets}
            onChange={(event) => onPlanTargetsChange(event.target.value)}
            disabled={loading}
            placeholder="plan targets (space-separated paths)"
          />
          <label className="small">
            <input type="checkbox" checked={autoMode} onChange={(event) => onAutoModeChange(event.target.checked)} /> Auto
            mode
          </label>
          <div className="replay-toolbar mt-8">
            <Button type="button" onClick={onCreatePlan} disabled={!sessionId || loading || !sessionWritable}>
              Create Plan
            </Button>
            <Button type="button" onClick={onExecutePlan} disabled={!activePlanId || loading || !sessionWritable}>
              Run Plan
            </Button>
            <Button type="button" variant="ghost" onClick={onRollbackPlan} disabled={!activePlanId || loading || !sessionWritable}>
              Rollback
            </Button>
          </div>
          {activePlanId ? <p className="small">Active plan: {activePlanId}</p> : null}
          {workflowOutput ? <pre className="proposal-preview mt-8">{workflowOutput}</pre> : null}
          <h4 className="small mt-8">Agent templates</h4>
          <input value={templateName} onChange={(event) => onTemplateNameChange(event.target.value)} disabled={loading} />
          <textarea rows={2} value={templatePrefix} onChange={(event) => onTemplatePrefixChange(event.target.value)} disabled={loading} />
          <Button type="button" onClick={onCreateTemplate} disabled={loading}>
            Save template
          </Button>
          {templates?.length ? (
            <ul className="small">
              {templates.map((template) => (
                <li key={template.template_id}>
                  <button type="button" className="ghost-btn inline-btn" onClick={() => onRunTemplate(template.template_id)}>
                    Use {template.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
