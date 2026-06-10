"use client";

import { useEffect, useMemo, useState } from "react";
import { canWriteSession, formatSessionListLabel, viewOnlySessionMessage } from "@codeforge/shared/sessions";

import {
  createCoworkJob,
  createCoworkPlan,
  createSession,
  extractCoworkData,
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
        source_path: planType === "extract" ? planSourcePath : null,
        url: planType === "browser" ? planUrl : null,
        browser_action: browserAction,
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
      toast.push("Browser and connector tasks require explicit approval");
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
    return (
      <section className="panel empty-state">
        <h2>Cowork</h2>
        <p className="small">Login from the top bar to run shell, browser, and extraction automations.</p>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <h2>Cowork automation</h2>
        <p className="small">
          Preview and run tasks against your workspace. Browser tasks need manual approval; scheduled jobs support
          shell and extract only.
        </p>
        {reliability ? (
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
        ) : null}
      </section>

      <div className="grid">
        <section className="panel">
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

        <section className="panel">
          <h3>Create plan</h3>
          <label className="small" htmlFor="planType">
            Task type
          </label>
          <select id="planType" value={planType} onChange={(event) => setPlanType(event.target.value)}>
            <option value="shell">Shell</option>
            <option value="extract">Extract</option>
            <option value="browser">Browser</option>
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

          {planType === "extract" ? (
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
      </div>

      <div className="grid">
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
          <h3>Recent runs</h3>
          {runs.length === 0 ? <p className="small">No runs yet.</p> : null}
          {runs.slice(0, 8).map((run) => (
            <div key={run.run_id} className="small" style={{ marginBottom: "0.5rem" }}>
              <strong>{run.run_id}</strong> — {run.status}: {run.summary}
            </div>
          ))}

          <hr className="divider" />
          <h3>Plans</h3>
          {plans.length === 0 ? <p className="small">No plans yet.</p> : null}
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

          <hr className="divider" />
          <h3>Extractions</h3>
          {extractions.length === 0 ? <p className="small">No extractions yet.</p> : null}
          {extractions.slice(0, 5).map((item) => (
            <div key={item.extraction_id} className="small" style={{ marginBottom: "0.5rem" }}>
              <strong>{item.source_path}</strong> — {item.method}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
