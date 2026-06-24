"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, Skeleton, Tabs } from "@codeforge/ui";
import { canWriteSession, formatSessionListLabel, viewOnlySessionMessage } from "@codeforge/shared/sessions";

import {
  createCoworkJob,
  createCoworkPlan,
  createSession,
  extractCoworkData,
  previewCoworkGoal,
  runCoworkGoal,
  scrapeCoworkData,
  getCoworkReliability,
  listCoworkExtractions,
  listCoworkJobs,
  listCoworkPlans,
  listCoworkRuns,
  listSessions,
  runCoworkPlan,
  toggleCoworkJob,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { ensureNotificationPermission, notifyCoworkJobComplete } from "../../lib/web-notifications";
import { useToast } from "../../lib/toast-context";

export default function CoworkPage() {
  const { token, ready } = useAuth();
  const toast = useToast();

  const [projectPath, setProjectPath] = useState("");
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [plans, setPlans] = useState([]);
  const [runs, setRuns] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [extractions, setExtractions] = useState([]);
  const [reliability, setReliability] = useState(null);
  const [loading, setLoading] = useState(false);

  const [planType, setPlanType] = useState("shell");
  const [planTitle, setPlanTitle] = useState("List workspace");
  const [planCommand, setPlanCommand] = useState("dir");
  const [planSourcePath, setPlanSourcePath] = useState("README.md");
  const [planUrl, setPlanUrl] = useState("https://example.com");
  const [browserAction, setBrowserAction] = useState("capture_title");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [browserApproved, setBrowserApproved] = useState(false);

  const [jobTitle, setJobTitle] = useState("Periodic shell check");
  const [jobTriggerType, setJobTriggerType] = useState("interval");
  const [jobIntervalSeconds, setJobIntervalSeconds] = useState(60);
  const [jobWatchPath, setJobWatchPath] = useState("README.md");
  const [jobTaskType, setJobTaskType] = useState("shell");
  const [jobCommand, setJobCommand] = useState("echo cowork");
  const [jobSourcePath, setJobSourcePath] = useState("README.md");

  const [extractPath, setExtractPath] = useState("");
  const [scrapeUrl, setScrapeUrl] = useState("https://example.com/docs");
  const [scrapeFilePath, setScrapeFilePath] = useState("");
  const [scrapePrompt, setScrapePrompt] = useState("Extract key API endpoints and authentication notes");
  const [scrapeApproved, setScrapeApproved] = useState(false);

  const [coworkGoal, setCoworkGoal] = useState(
    "Organize files in Downloads by date, extract text from documents, and synthesize a summary report",
  );
  const [goalPreview, setGoalPreview] = useState(null);
  const [goalApproved, setGoalApproved] = useState(false);
  const [goalResult, setGoalResult] = useState(null);
  const prevJobStatusRef = useRef({});

  const currentSession = useMemo(
    () => sessions.find((session) => session.session_id === sessionId) || null,
    [sessionId, sessions],
  );

  const sessionWritable = useMemo(() => canWriteSession(currentSession), [currentSession]);

  async function refreshCoworkData(activeToken = token) {
    if (!activeToken) {
      return;
    }
    const [nextPlans, nextRuns, nextJobs, nextExtractions, nextReliability] = await Promise.all([
      listCoworkPlans(activeToken),
      listCoworkRuns(activeToken),
      listCoworkJobs(activeToken),
      listCoworkExtractions(activeToken),
      getCoworkReliability(activeToken),
    ]);
    setPlans(nextPlans.plans || []);
    setRuns(nextRuns.runs || []);
    setJobs(nextJobs.jobs || []);
    setExtractions(nextExtractions.extractions || []);
    setReliability(nextReliability);

    const nextJobList = nextJobs.jobs || [];
    for (const job of nextJobList) {
      const prev = prevJobStatusRef.current[job.job_id];
      const lastRun = job.last_run_status || job.status;
      if (prev && prev !== "completed" && lastRun === "completed") {
        notifyCoworkJobComplete({
          title: `Cowork: ${job.title || job.job_id}`,
          body: "Scheduled job finished successfully.",
          tag: job.job_id,
        });
      }
      prevJobStatusRef.current[job.job_id] = lastRun;
    }
  }

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    setProjectPath(localStorage.getItem("codeforge_project_path") || "");
    setLoading(true);
    listSessions(token)
      .then((list) => {
        setSessions(list);
        if (list.length > 0) {
          setSessionId(list[0].session_id);
        }
        return refreshCoworkData(token);
      })
      .catch((error) => toast.push(error.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    ensureNotificationPermission().catch(() => undefined);
    const intervalId = window.setInterval(() => {
      refreshCoworkData(token).catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreateSession() {
    if (!token || !projectPath.trim()) {
      toast.push("Set a project path in Settings first");
      return;
    }
    setLoading(true);
    try {
      const created = await createSession(projectPath.trim(), token);
      const list = await listSessions(token);
      setSessions(list);
      setSessionId(created.session_id);
      toast.push(`Session ${created.session_id} created`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlan() {
    if (!token || !sessionId) {
      toast.push("Create or select a session first");
      return;
    }
    setLoading(true);
    try {
      const plan = await createCoworkPlan(token, {
        session_id: sessionId,
        title: planTitle,
        task_type: planType,
        command: planType === "shell" ? planCommand : null,
        source_path:
          planType === "extract" || planType === "file_ops" || planType === "synthesize"
            ? planSourcePath
            : planType === "scrape" && planSourcePath.trim()
              ? planSourcePath
              : null,
        url:
          planType === "browser"
            ? planUrl
            : planType === "scrape" && planUrl.trim()
              ? planUrl
              : null,
        browser_action: browserAction,
        scrape_prompt: planType === "scrape" ? scrapePrompt : null,
        connector_arguments:
          planType === "scrape"
            ? { scrape_prompt: scrapePrompt, ingest_knowledge: true, ingest_memory: true }
            : planType === "file_ops"
              ? { action: "organize_by_date" }
              : planType === "synthesize"
                ? { format: "markdown", output_name: "cowork-report.md", prompt: planTitle }
                : {},
      });
      setSelectedPlan(plan);
      setBrowserApproved(false);
      toast.push(`Plan ${plan.plan_id} previewed`, "success");
      await refreshCoworkData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunPlan(plan) {
    if (!token || !plan) {
      return;
    }
    if (plan.requires_approval && !browserApproved) {
      toast.push("Browser, scrape, and connector tasks require explicit approval");
      return;
    }
    setLoading(true);
    try {
      const run = await runCoworkPlan(token, plan.plan_id, browserApproved);
      toast.push(`Run ${run.run_id}: ${run.summary}`, run.status === "completed" ? "success" : undefined);
      await refreshCoworkData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateJob() {
    if (!token || !sessionId) {
      toast.push("Create or select a session first");
      return;
    }
    setLoading(true);
    try {
      const job = await createCoworkJob(token, {
        session_id: sessionId,
        title: jobTitle,
        trigger_type: jobTriggerType,
        interval_seconds: Number(jobIntervalSeconds) || 60,
        watch_path: jobTriggerType === "file_change" ? jobWatchPath : null,
        task_type: jobTaskType,
        command: jobTaskType === "shell" ? jobCommand : null,
        source_path: jobTaskType === "extract" ? jobSourcePath : null,
      });
      toast.push(`Job ${job.job_id} created`, "success");
      await refreshCoworkData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleJob(job, enabled) {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      await toggleCoworkJob(token, job.job_id, enabled);
      await refreshCoworkData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleScrapeNow(event) {
    event?.preventDefault?.();
    if (!token || !sessionId || !scrapePrompt.trim()) {
      toast.push("Create or select a session and enter a scrape prompt");
      return;
    }
    if (!scrapeApproved) {
      toast.push("Approve the scrape task before running");
      return;
    }
    setLoading(true);
    try {
      const result = await scrapeCoworkData(token, {
        session_id: sessionId,
        scrape_prompt: scrapePrompt.trim(),
        url: scrapeFilePath.trim() ? null : scrapeUrl.trim(),
        source_path: scrapeFilePath.trim() || null,
        approved: true,
      });
      toast.push(`Scrape ${result.run_id}: ${result.summary}`, result.status === "completed" ? "success" : undefined);
      await refreshCoworkData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreviewGoal() {
    if (!token || !sessionId || !coworkGoal.trim()) {
      toast.push("Select a session and describe your Cowork goal");
      return;
    }
    setLoading(true);
    try {
      const preview = await previewCoworkGoal(token, {
        session_id: sessionId,
        goal: coworkGoal.trim(),
      });
      setGoalPreview(preview);
      setGoalApproved(false);
      setGoalResult(null);
      toast.push(`Planned ${preview.step_count} autonomous step(s)`, "success");
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunGoal() {
    if (!token || !sessionId || !coworkGoal.trim()) {
      return;
    }
    if (goalPreview?.requires_approval && !goalApproved) {
      toast.push("Approve the workflow before running");
      return;
    }
    setLoading(true);
    try {
      const result = await runCoworkGoal(token, {
        session_id: sessionId,
        goal: coworkGoal.trim(),
        approved: goalApproved || !goalPreview?.requires_approval,
      });
      setGoalResult(result);
      toast.push(result.summary, result.status === "completed" ? "success" : undefined);
      await refreshCoworkData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExtractNow() {
    if (!token || !sessionId) {
      toast.push("Create or select a session first");
      return;
    }
    if (!extractPath.trim()) {
      toast.push("Enter a source file path");
      return;
    }
    setLoading(true);
    try {
      const extraction = await extractCoworkData(token, {
        session_id: sessionId,
        source_path: extractPath.trim(),
      });
      toast.push(`Extraction ${extraction.extraction_id} completed`, "success");
      await refreshCoworkData(token);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (ready && !token) {
    return null;
  }

  if (!ready) {
    return (
      <section className="panel">
        <Skeleton style={{ height: "2rem", marginBottom: "1rem" }} />
        <Skeleton style={{ height: "10rem" }} />
      </section>
    );
  }

  const sessionPicker = (
        <section className="panel cowork-session-bar">
          <h3>Session</h3>
          <p className="small">Project: {projectPath || "Not set — configure in Settings"}</p>
          <button type="button" onClick={handleCreateSession} disabled={loading || !projectPath.trim()}>
            Create session
          </button>
          <hr className="divider" />
          <label className="small" htmlFor="coworkSession">
            Active session
          </label>
          <select
            id="coworkSession"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            disabled={loading || sessions.length === 0}
          >
            {sessions.length === 0 ? <option value="">No sessions</option> : null}
            {sessions.map((session) => (
              <option key={session.session_id} value={session.session_id}>
                {formatSessionListLabel(session)}
              </option>
            ))}
          </select>
          {currentSession?.project_path ? (
            <p className="small">Workspace: {currentSession.project_path}</p>
          ) : null}
          {!sessionWritable && currentSession ? (
            <p className="small">{viewOnlySessionMessage(currentSession)}</p>
          ) : null}
        </section>
  );

  const plansTab = (
    <div className="grid">
        <section className="panel">
          <h3>Create plan</h3>
          <label className="small" htmlFor="planType">
            Task type
          </label>
          <select id="planType" value={planType} onChange={(event) => setPlanType(event.target.value)}>
            <option value="shell">Shell</option>
            <option value="extract">Extract</option>
            <option value="browser">Browser</option>
            <option value="scrape">Scrape (ScrapeGraphAI)</option>
            <option value="file_ops">File organize / rename</option>
            <option value="synthesize">Synthesize report</option>
          </select>

          <label className="small" htmlFor="planTitle">
            Title
          </label>
          <input id="planTitle" value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} />

          {planType === "shell" ? (
            <>
              <label className="small" htmlFor="planCommand">
                Command
              </label>
              <input id="planCommand" value={planCommand} onChange={(event) => setPlanCommand(event.target.value)} />
            </>
          ) : null}

          {planType === "extract" || planType === "file_ops" || planType === "synthesize" ? (
            <>
              <label className="small" htmlFor="planSourcePath">
                Source path
              </label>
              <input
                id="planSourcePath"
                value={planSourcePath}
                onChange={(event) => setPlanSourcePath(event.target.value)}
              />
            </>
          ) : null}

          {planType === "browser" ? (
            <>
              <label className="small" htmlFor="planUrl">
                URL
              </label>
              <input id="planUrl" value={planUrl} onChange={(event) => setPlanUrl(event.target.value)} />
              <label className="small" htmlFor="browserAction">
                Browser action
              </label>
              <select
                id="browserAction"
                value={browserAction}
                onChange={(event) => setBrowserAction(event.target.value)}
              >
                <option value="capture_title">Capture title</option>
                <option value="extract_links">Extract links</option>
              </select>
              <label className="small">
                <input
                  type="checkbox"
                  checked={browserApproved}
                  onChange={(event) => setBrowserApproved(event.target.checked)}
                />{" "}
                I approve running this browser task
              </label>
            </>
          ) : null}

          {planType === "scrape" ? (
            <>
              <label className="small" htmlFor="scrapePlanUrl">
                URL (leave empty if using local file)
              </label>
              <input id="scrapePlanUrl" value={planUrl} onChange={(event) => setPlanUrl(event.target.value)} />
              <label className="small" htmlFor="scrapePlanSourcePath">
                Local file path (optional)
              </label>
              <input
                id="scrapePlanSourcePath"
                value={planSourcePath}
                onChange={(event) => setPlanSourcePath(event.target.value)}
              />
              <label className="small" htmlFor="scrapePlanPrompt">
                Extraction prompt
              </label>
              <textarea
                id="scrapePlanPrompt"
                rows={3}
                value={scrapePrompt}
                onChange={(event) => setScrapePrompt(event.target.value)}
              />
              <label className="small">
                <input
                  type="checkbox"
                  checked={browserApproved}
                  onChange={(event) => setBrowserApproved(event.target.checked)}
                />{" "}
                I approve running this ScrapeGraphAI task
              </label>
            </>
          ) : null}

          <button type="button" onClick={handleCreatePlan} disabled={loading || !sessionId || !sessionWritable}>
            Preview plan
          </button>

          {selectedPlan ? (
            <div className="stack" style={{ marginTop: "0.75rem" }}>
              <p className="small">
                Selected: <strong>{selectedPlan.plan_id}</strong>
                {selectedPlan.requires_approval ? " (approval required)" : ""}
              </p>
              <ul className="small">
                {(selectedPlan.preview_steps || []).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <button type="button" onClick={() => handleRunPlan(selectedPlan)} disabled={loading}>
                Run plan
              </button>
            </div>
          ) : null}
        </section>
        <section className="panel">
          <h3>Plans</h3>
          {plans.length === 0 ? <EmptyState title="No plans" description="Create a plan to preview automation steps." /> : null}
          {plans.slice(0, 6).map((plan) => (
            <button
              key={plan.plan_id}
              type="button"
              className="ghost-btn"
              onClick={() => {
                setSelectedPlan(plan);
                setBrowserApproved(false);
              }}
            >
              {plan.title} ({plan.task_type}) — {plan.status}
            </button>
          ))}
        </section>
    </div>
  );

  const jobsTab = (
        <section className="panel">
          <h3>Scheduled jobs</h3>
          <p className="small">Jobs can run shell or extract tasks on an interval or file change.</p>
          <label className="small" htmlFor="jobTitle">
            Title
          </label>
          <input id="jobTitle" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
          <label className="small" htmlFor="jobTriggerType">
            Trigger
          </label>
          <select
            id="jobTriggerType"
            value={jobTriggerType}
            onChange={(event) => setJobTriggerType(event.target.value)}
          >
            <option value="interval">Interval</option>
            <option value="file_change">File change</option>
          </select>
          {jobTriggerType === "interval" ? (
            <>
              <label className="small" htmlFor="jobIntervalSeconds">
                Interval (seconds)
              </label>
              <input
                id="jobIntervalSeconds"
                type="number"
                min="15"
                value={jobIntervalSeconds}
                onChange={(event) => setJobIntervalSeconds(event.target.value)}
              />
            </>
          ) : (
            <>
              <label className="small" htmlFor="jobWatchPath">
                Watch path
              </label>
              <input
                id="jobWatchPath"
                value={jobWatchPath}
                onChange={(event) => setJobWatchPath(event.target.value)}
              />
            </>
          )}
          <label className="small" htmlFor="jobTaskType">
            Task type
          </label>
          <select id="jobTaskType" value={jobTaskType} onChange={(event) => setJobTaskType(event.target.value)}>
            <option value="shell">Shell</option>
            <option value="extract">Extract</option>
          </select>
          {jobTaskType === "shell" ? (
            <>
              <label className="small" htmlFor="jobCommand">
                Command
              </label>
              <input id="jobCommand" value={jobCommand} onChange={(event) => setJobCommand(event.target.value)} />
            </>
          ) : (
            <>
              <label className="small" htmlFor="jobSourcePath">
                Source path
              </label>
              <input
                id="jobSourcePath"
                value={jobSourcePath}
                onChange={(event) => setJobSourcePath(event.target.value)}
              />
            </>
          )}
          <button type="button" onClick={handleCreateJob} disabled={loading || !sessionId || !sessionWritable}>
            Create job
          </button>

          <hr className="divider" />
          {jobs.length === 0 ? <p className="small">No jobs yet.</p> : null}
          {jobs.map((job) => (
            <div key={job.job_id} className="stack" style={{ marginBottom: "0.75rem" }}>
              <strong>{job.title}</strong>
              <span className="small">
                {job.task_type} · {job.trigger_type} · last {job.last_status}
                {job.circuit_broken ? " · circuit broken" : ""}
              </span>
              <button
                type="button"
                className="ghost-btn inline-btn"
                onClick={() => handleToggleJob(job, !job.enabled)}
                disabled={loading}
              >
                {job.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
        </section>
  );

  const extractionsTab = (
        <section className="panel">
          <h3>Quick extract</h3>
          <label className="small" htmlFor="extractPath">
            Source path
          </label>
          <input id="extractPath" value={extractPath} onChange={(event) => setExtractPath(event.target.value)} />
          <button type="button" onClick={handleExtractNow} disabled={loading || !sessionId || !sessionWritable}>
            Extract now
          </button>

          <hr className="divider" />
          <h3>Quick scrape (ScrapeGraphAI)</h3>
          <p className="small">
            Natural-language extraction from a URL or local HTML/JSON/Markdown file. Results ingest into project
            knowledge and agent memory.
          </p>
          <label className="small" htmlFor="scrapeUrl">
            URL
          </label>
          <input id="scrapeUrl" value={scrapeUrl} onChange={(event) => setScrapeUrl(event.target.value)} />
          <label className="small" htmlFor="scrapeFilePath">
            Or local file path
          </label>
          <input
            id="scrapeFilePath"
            value={scrapeFilePath}
            onChange={(event) => setScrapeFilePath(event.target.value)}
          />
          <label className="small" htmlFor="scrapePrompt">
            Prompt
          </label>
          <textarea
            id="scrapePrompt"
            rows={3}
            value={scrapePrompt}
            onChange={(event) => setScrapePrompt(event.target.value)}
          />
          <label className="small">
            <input
              type="checkbox"
              checked={scrapeApproved}
              onChange={(event) => setScrapeApproved(event.target.checked)}
            />{" "}
            I approve running this scrape task
          </label>
          <button type="button" onClick={handleScrapeNow} disabled={loading || !sessionId || !sessionWritable}>
            Scrape now
          </button>

          <hr className="divider" />
          <h3>Recent runs</h3>
          {runs.length === 0 ? <p className="small">No runs yet.</p> : null}
          {runs.slice(0, 8).map((run) => (
            <div key={run.run_id} className="small" style={{ marginBottom: "0.5rem" }}>
              <strong>{run.run_id}</strong> — {run.status}: {run.summary}
            </div>
          ))}

          <hr className="divider" />
          <h3>Extractions</h3>
          {extractions.length === 0 ? <p className="small">No extractions yet.</p> : null}
          {extractions.slice(0, 5).map((item) => (
            <div key={item.extraction_id} className="small" style={{ marginBottom: "0.5rem" }}>
              <strong>{item.source_path}</strong> — {item.method}
            </div>
          ))}
        </section>
  );

  const reliabilityTab = reliability ? (
    <div className="stats-grid">
      <article className="stat-card">
        <p className="small">Enabled jobs</p>
        <h2>{reliability.enabled_jobs}</h2>
      </article>
      <article className="stat-card">
        <p className="small">Recent failure rate</p>
        <h2>{(reliability.recent_failure_rate * 100).toFixed(0)}%</h2>
      </article>
      <article className="stat-card">
        <p className="small">Circuit broken</p>
        <h2>{reliability.circuit_broken_jobs}</h2>
      </article>
    </div>
  ) : (
    <EmptyState title="No reliability data" description="Create jobs and runs to see reliability metrics." />
  );

  return (
    <div className="stack">
      <section className="panel cowork-hero">
        <h2>CodeForge Cowork</h2>
        <p className="small">
          Autonomous agent mode for knowledge work — organize files, extract documents, synthesize reports, scrape the
          web, and run multi-step workflows. More powerful than chat: give one goal and Cowork executes it end-to-end.
        </p>
        <label className="small" htmlFor="coworkGoal">
          What should Cowork accomplish?
        </label>
        <textarea
          id="coworkGoal"
          rows={4}
          value={coworkGoal}
          onChange={(event) => setCoworkGoal(event.target.value)}
          placeholder="Organize files in ./notes by date, extract PDFs, and synthesize a market analysis report"
          disabled={loading || !sessionId}
        />
        <div className="agent-tools-row" style={{ marginTop: "0.5rem" }}>
          <button type="button" onClick={handlePreviewGoal} disabled={loading || !sessionId || !coworkGoal.trim()}>
            Preview workflow
          </button>
          <button
            type="button"
            onClick={handleRunGoal}
            disabled={loading || !sessionId || !sessionWritable || !coworkGoal.trim()}
          >
            Run autonomous workflow
          </button>
        </div>
        {goalPreview ? (
          <div className="stack" style={{ marginTop: "0.75rem" }}>
            <p className="small">
              <strong>{goalPreview.step_count} steps</strong>
              {goalPreview.requires_approval ? " — approval required for file/browser/scrape actions" : ""}
            </p>
            <ul className="small">
              {(goalPreview.preview_lines || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {goalPreview.requires_approval ? (
              <label className="small">
                <input
                  type="checkbox"
                  checked={goalApproved}
                  onChange={(event) => setGoalApproved(event.target.checked)}
                />{" "}
                I approve this autonomous Cowork workflow
              </label>
            ) : null}
          </div>
        ) : null}
        {goalResult ? (
          <div className="stack" style={{ marginTop: "0.75rem" }}>
            <p className="small">
              <strong>{goalResult.status}</strong> — {goalResult.summary}
            </p>
            <ul className="small">
              {(goalResult.step_results || []).map((step) => (
                <li key={`${step.step_id}-${step.task_type}`}>
                  {step.task_type}: {step.summary}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
      {sessionPicker}
      <Tabs
        defaultTab="plans"
        tabs={[
          { id: "plans", label: "Plans", content: plansTab },
          { id: "jobs", label: "Jobs", content: jobsTab },
          { id: "extractions", label: "Extractions", content: extractionsTab },
          { id: "reliability", label: "Reliability", content: reliabilityTab },
        ]}
      />
    </div>
  );
}
