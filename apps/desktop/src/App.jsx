import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import {
  applyGitConflictAssist,
  createCoworkJob,
  createCoworkPlan,
  createSession,
  devLogin,
  extractCoworkData,
  getGitConflictGuide,
  getSynthesisRolloutPlan,
  listCoworkExtractions,
  listCoworkJobs,
  listCoworkPlans,
  listCoworkRuns,
  listSessions,
  runCoworkPlan,
  toggleCoworkJob,
} from "./api";

export default function App() {
  const [userId, setUserId] = useState("paras");
  const [projectPath, setProjectPath] = useState("c:/Users/paras/Codeforge");
  const [token, setToken] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [plans, setPlans] = useState([]);
  const [runs, setRuns] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [extractions, setExtractions] = useState([]);
  const [planType, setPlanType] = useState("shell");
  const [planTitle, setPlanTitle] = useState("");
  const [planCommand, setPlanCommand] = useState("Get-Location");
  const [planSourcePath, setPlanSourcePath] = useState("");
  const [planUrl, setPlanUrl] = useState("https://example.com");
  const [browserAction, setBrowserAction] = useState("capture_title");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [browserApproved, setBrowserApproved] = useState(false);
  const [jobTitle, setJobTitle] = useState("Watch workspace notes");
  const [jobTriggerType, setJobTriggerType] = useState("interval");
  const [jobIntervalSeconds, setJobIntervalSeconds] = useState(30);
  const [jobWatchPath, setJobWatchPath] = useState("README.md");
  const [jobTaskType, setJobTaskType] = useState("shell");
  const [jobCommand, setJobCommand] = useState("Get-ChildItem");
  const [jobSourcePath, setJobSourcePath] = useState("README.md");
  const [jobUrl, setJobUrl] = useState("https://example.com");
  const [jobBrowserAction, setJobBrowserAction] = useState("extract_links");
  const [extractPath, setExtractPath] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notifiedRunIds, setNotifiedRunIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rolloutEnvironment, setRolloutEnvironment] = useState("local");
  const [rolloutPlan, setRolloutPlan] = useState(null);
  const [conflictTargetBranch, setConflictTargetBranch] = useState("main");
  const [conflictGuide, setConflictGuide] = useState(null);
  const [conflictStrategy, setConflictStrategy] = useState("ours");
  const [conflictPaths, setConflictPaths] = useState("");
  const [conflictApplyResult, setConflictApplyResult] = useState(null);

  const currentSession = useMemo(
    () => sessions.find((session) => session.session_id === sessionId) || null,
    [sessionId, sessions],
  );

  async function handlePickPath() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        setProjectPath(selected);
      }
    } catch {
      // Running outside Tauri during plain web dev.
    }
  }

  async function handlePickExtractPath() {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        setExtractPath(selected);
        if (!planSourcePath) {
          setPlanSourcePath(selected);
        }
      }
    } catch {
      // Running outside Tauri during plain web dev.
    }
  }

  async function handleNotify() {
    try {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
      }
      if (permissionGranted) {
        sendNotification({
          title: "CodeForge Desktop",
          body: "Desktop native notification wiring is active.",
        });
      }
    } catch {
      // Running outside Tauri during plain web dev.
    }
  }

  async function pushCoworkNotification(title, body) {
    try {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
      }
      if (permissionGranted) {
        sendNotification({ title, body });
      }
    } catch {
      // Running outside Tauri during plain web dev.
    }
  }

  async function refreshCoworkData(activeToken = token) {
    if (!activeToken) {
      return;
    }
    const [nextPlans, nextRuns, nextJobs, nextExtractions] = await Promise.all([
      listCoworkPlans(activeToken),
      listCoworkRuns(activeToken),
      listCoworkJobs(activeToken),
      listCoworkExtractions(activeToken),
    ]);

    const planList = nextPlans.plans || [];
    const runList = nextRuns.runs || [];
    const jobList = nextJobs.jobs || [];
    const extractionList = nextExtractions.extractions || [];

    setPlans(planList);
    setRuns(runList);
    setJobs(jobList);
    setExtractions(extractionList);

    const freshCompleted = runList
      .filter((item) => item.status === "completed")
      .filter((item) => !notifiedRunIds.includes(item.run_id));

    if (freshCompleted.length > 0) {
      const latest = freshCompleted[0];
      await pushCoworkNotification("CodeForge Cowork", `${latest.summary}`);
      setNotifiedRunIds((previous) => [
        ...previous,
        ...freshCompleted.map((item) => item.run_id),
      ].slice(-100));
    }
  }

  async function refreshRolloutPlan(activeToken = token, environment = rolloutEnvironment) {
    if (!activeToken) {
      return;
    }
    const plan = await getSynthesisRolloutPlan(activeToken, environment);
    setRolloutPlan(plan);
  }

  async function handleLoadConflictGuide() {
    if (!token || !sessionId) {
      setErrorMessage("Create/select a session first");
      return;
    }
    if (!conflictTargetBranch.trim()) {
      setErrorMessage("Target branch is required");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const guide = await getGitConflictGuide(token, sessionId, conflictTargetBranch.trim());
      setConflictGuide(guide);
      setConflictApplyResult(null);
      setConflictPaths((guide.conflict_files || []).join("\n"));
      setStatusMessage(`Conflict guide loaded (${(guide.conflict_files || []).length} files)`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyConflictAssist() {
    if (!token || !sessionId) {
      setErrorMessage("Create/select a session first");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const paths = conflictPaths
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
      const result = await applyGitConflictAssist(token, sessionId, {
        target_branch: conflictTargetBranch.trim(),
        strategy: conflictStrategy,
        paths,
      });
      setConflictApplyResult(result);
      setConflictPaths((result.remaining_conflicts || []).join("\n"));
      if (conflictGuide) {
        setConflictGuide({
          ...conflictGuide,
          conflict_files: result.remaining_conflicts || [],
          has_conflicts: (result.remaining_conflicts || []).length > 0,
        });
      }
      setStatusMessage(`Applied ${conflictStrategy} strategy to ${(result.applied_paths || []).length} files`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setLoading(true);
    setErrorMessage("");
    try {
      const nextToken = await devLogin(userId.trim());
      setToken(nextToken);
      const list = await listSessions(nextToken);
      setSessions(list);
      if (list.length > 0) {
        setSessionId(list[0].session_id);
      }
      await refreshCoworkData(nextToken);
      await refreshRolloutPlan(nextToken, rolloutEnvironment);
      setStatusMessage(`Logged in as ${userId.trim()}`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSession() {
    if (!token) {
      setErrorMessage("Login first");
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const created = await createSession(token, projectPath);
      const list = await listSessions(token);
      setSessions(list);
      setSessionId(created.session_id);
      await refreshRolloutPlan(token, rolloutEnvironment);
      setStatusMessage(`Session ${created.session_id} created`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePlan() {
    if (!token || !sessionId) {
      setErrorMessage("Create/select a session first");
      return;
    }

    setLoading(true);
    setErrorMessage("");
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
      setStatusMessage(`Plan ${plan.plan_id} previewed`);
      await refreshCoworkData(token);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunPlan(plan) {
    if (!token || !plan) {
      return;
    }

    if (plan.requires_approval && !browserApproved) {
      setErrorMessage("Browser tasks require explicit approval before run");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const run = await runCoworkPlan(token, plan.plan_id, browserApproved);
      setStatusMessage(`Run ${run.run_id}: ${run.summary}`);
      await refreshCoworkData(token);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateJob() {
    if (!token || !sessionId) {
      setErrorMessage("Create/select a session first");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const job = await createCoworkJob(token, {
        session_id: sessionId,
        title: jobTitle,
        trigger_type: jobTriggerType,
        interval_seconds: Number(jobIntervalSeconds) || 30,
        watch_path: jobTriggerType === "file_change" ? jobWatchPath : null,
        task_type: jobTaskType,
        command: jobTaskType === "shell" ? jobCommand : null,
        source_path: jobTaskType === "extract" ? jobSourcePath : null,
        url: jobTaskType === "browser" ? jobUrl : null,
        browser_action: jobBrowserAction,
      });
      setStatusMessage(`Job ${job.job_id} created`);
      await refreshCoworkData(token);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleJob(job, enabled) {
    if (!token) {
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      await toggleCoworkJob(token, job.job_id, enabled);
      await refreshCoworkData(token);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExtractNow() {
    if (!token || !sessionId) {
      setErrorMessage("Create/select a session first");
      return;
    }
    if (!extractPath.trim()) {
      setErrorMessage("Pick or enter a source file path first");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const extraction = await extractCoworkData(token, {
        session_id: sessionId,
        source_path: extractPath,
      });
      setStatusMessage(`Extraction ${extraction.extraction_id} completed using ${extraction.method}`);
      await refreshCoworkData(token);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    const intervalId = window.setInterval(() => {
      refreshCoworkData(token).catch(() => null);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [token, notifiedRunIds]);

  useEffect(() => {
    if (!sessionId && sessions.length > 0) {
      setSessionId(sessions[0].session_id);
    }
  }, [sessionId, sessions]);

  useEffect(() => {
    if (!token) {
      return;
    }
    refreshRolloutPlan(token, rolloutEnvironment).catch(() => null);
  }, [token, rolloutEnvironment]);

  return (
    <main className="desktop-main">
      <h1>CodeForge Desktop</h1>
      <p className="muted">Phase 4 cowork mode: safe desktop automation with preview, scheduling, extraction, and explicit browser approval.</p>

      {statusMessage ? <div className="status success">{statusMessage}</div> : null}
      {errorMessage ? <div className="status error">{errorMessage}</div> : null}

      <section className="card">
        <label htmlFor="uid">User ID</label>
        <input id="uid" value={userId} onChange={(event) => setUserId(event.target.value)} disabled={loading} />
        <button onClick={handleLogin} disabled={!userId.trim() || loading}>{token ? "Re-login" : "Login"}</button>
      </section>

      <section className="card">
        <label htmlFor="path">Project Path</label>
        <input id="path" value={projectPath} onChange={(event) => setProjectPath(event.target.value)} disabled={loading} />
        <button type="button" onClick={handlePickPath} disabled={loading}>Pick Folder (Native)</button>
        <button onClick={handleCreateSession} disabled={!token || !projectPath.trim() || loading}>Create Session</button>
        <button type="button" onClick={handleNotify} disabled={loading}>Send Notification</button>
      </section>

      <section className="card">
        <h2>Saved Sessions</h2>
        <label htmlFor="session-select">Active Session</label>
        <select id="session-select" value={sessionId} onChange={(event) => setSessionId(event.target.value)} disabled={loading || sessions.length === 0}>
          {sessions.map((session) => (
            <option key={session.session_id} value={session.session_id}>{session.session_id}</option>
          ))}
        </select>
        {currentSession ? <p className="muted">Project: {currentSession.project_path}</p> : null}
        {sessions.length === 0 ? <p className="muted">No sessions yet.</p> : null}
        {sessions.map((session) => (
          <div key={session.session_id} className="session-row">{session.session_id}</div>
        ))}
      </section>

      <section className="card">
        <h2>Synthesis Rollout Plan</h2>
        <label htmlFor="rollout-env">Environment</label>
        <select
          id="rollout-env"
          value={rolloutEnvironment}
          onChange={(event) => setRolloutEnvironment(event.target.value)}
          disabled={loading || !token}
        >
          <option value="local">local</option>
          <option value="staging">staging</option>
          <option value="production">production</option>
        </select>
        <button type="button" onClick={() => refreshRolloutPlan(token, rolloutEnvironment)} disabled={!token || loading}>
          Refresh Rollout Plan
        </button>

        {rolloutPlan ? (
          <div className="preview-box">
            <p><strong>Recommended Provider:</strong> {rolloutPlan.recommended_provider}</p>
            <p><strong>Strategy:</strong> {rolloutPlan.strategy}</p>
            <p>
              <strong>Missing Env:</strong>{" "}
              {(rolloutPlan.providers || [])
                .flatMap((provider) => provider.required_env || [])
                .filter((item) => item.required && !item.set)
                .map((item) => item.name)
                .join(", ") || "none"}
            </p>
            <ul>
              {(rolloutPlan.automation_steps || []).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="muted">No rollout plan loaded.</p>
        )}
      </section>

      <section className="card">
        <h2>Git Conflict Assistant</h2>
        <label htmlFor="conflict-branch">Target Branch</label>
        <input
          id="conflict-branch"
          value={conflictTargetBranch}
          onChange={(event) => setConflictTargetBranch(event.target.value)}
          disabled={loading || !token}
        />
        <div className="button-row">
          <button type="button" onClick={handleLoadConflictGuide} disabled={loading || !token || !sessionId}>
            Load Conflict Guide
          </button>
          <select value={conflictStrategy} onChange={(event) => setConflictStrategy(event.target.value)} disabled={loading || !token}>
            <option value="ours">Use ours</option>
            <option value="theirs">Use theirs</option>
          </select>
        </div>
        <label htmlFor="conflict-paths">Paths (one per line, blank = all unresolved)</label>
        <textarea
          id="conflict-paths"
          rows={5}
          value={conflictPaths}
          onChange={(event) => setConflictPaths(event.target.value)}
          disabled={loading || !token}
        />
        <button type="button" onClick={handleApplyConflictAssist} disabled={loading || !token || !sessionId}>
          Apply Strategy and Stage
        </button>

        {conflictGuide ? (
          <div className="preview-box">
            <p><strong>Current Branch:</strong> {conflictGuide.current_branch}</p>
            <p><strong>Conflict Files:</strong> {(conflictGuide.conflict_files || []).length}</p>
            <ul>
              {(conflictGuide.steps || []).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {conflictApplyResult ? (
          <div className="preview-box">
            <p><strong>Applied Paths:</strong> {(conflictApplyResult.applied_paths || []).length}</p>
            <p><strong>Remaining Conflicts:</strong> {(conflictApplyResult.remaining_conflicts || []).length}</p>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>T4.1 Cowork Task Runner</h2>
        <label htmlFor="plan-title">Task Title</label>
        <input id="plan-title" value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} disabled={loading} />
        <label htmlFor="plan-type">Task Type</label>
        <select id="plan-type" value={planType} onChange={(event) => setPlanType(event.target.value)} disabled={loading}>
          <option value="shell">Shell automation</option>
          <option value="extract">OCR/extraction</option>
          <option value="browser">Browser automation</option>
        </select>

        {planType === "shell" ? (
          <>
            <label htmlFor="plan-command">Safe Command</label>
            <input id="plan-command" value={planCommand} onChange={(event) => setPlanCommand(event.target.value)} disabled={loading} />
          </>
        ) : null}

        {planType === "extract" ? (
          <>
            <label htmlFor="plan-source">Source Path</label>
            <input id="plan-source" value={planSourcePath} onChange={(event) => setPlanSourcePath(event.target.value)} disabled={loading} />
          </>
        ) : null}

        {planType === "browser" ? (
          <>
            <label htmlFor="plan-url">URL</label>
            <input id="plan-url" value={planUrl} onChange={(event) => setPlanUrl(event.target.value)} disabled={loading} />
            <label htmlFor="browser-action">Browser Action</label>
            <select id="browser-action" value={browserAction} onChange={(event) => setBrowserAction(event.target.value)} disabled={loading}>
              <option value="capture_title">Capture page title</option>
              <option value="extract_links">Extract links</option>
            </select>
          </>
        ) : null}

        <div className="button-row">
          <button type="button" onClick={handleCreatePlan} disabled={loading || !token || !sessionId}>Preview Task Plan</button>
          <button type="button" onClick={() => selectedPlan && handleRunPlan(selectedPlan)} disabled={loading || !selectedPlan}>Run Selected Plan</button>
        </div>

        {selectedPlan ? (
          <div className="preview-box">
            <p><strong>Plan:</strong> {selectedPlan.plan_id}</p>
            <p><strong>Task Type:</strong> {selectedPlan.task_type}</p>
            <p><strong>Requires Approval:</strong> {selectedPlan.requires_approval ? "Yes" : "No"}</p>
            <ul>
              {selectedPlan.preview_steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            {selectedPlan.requires_approval ? (
              <label className="approve-toggle">
                <input type="checkbox" checked={browserApproved} onChange={(event) => setBrowserApproved(event.target.checked)} />
                I explicitly approve this browser task and understand it is visible in run logs.
              </label>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>T4.2 Watchers and Scheduled Jobs</h2>
        <label htmlFor="job-title">Job Title</label>
        <input id="job-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} disabled={loading} />
        <label htmlFor="job-trigger">Trigger</label>
        <select id="job-trigger" value={jobTriggerType} onChange={(event) => setJobTriggerType(event.target.value)} disabled={loading}>
          <option value="interval">Recurring interval</option>
          <option value="file_change">File watcher</option>
        </select>

        {jobTriggerType === "interval" ? (
          <>
            <label htmlFor="job-interval">Interval Seconds</label>
            <input id="job-interval" type="number" min={5} value={jobIntervalSeconds} onChange={(event) => setJobIntervalSeconds(event.target.value)} disabled={loading} />
          </>
        ) : (
          <>
            <label htmlFor="job-watch">Watch Path (relative or absolute)</label>
            <input id="job-watch" value={jobWatchPath} onChange={(event) => setJobWatchPath(event.target.value)} disabled={loading} />
          </>
        )}

        <label htmlFor="job-task-type">Job Task Type</label>
        <select id="job-task-type" value={jobTaskType} onChange={(event) => setJobTaskType(event.target.value)} disabled={loading}>
          <option value="shell">Shell automation</option>
          <option value="extract">OCR/extraction</option>
          <option value="browser">Browser automation</option>
        </select>

        {jobTaskType === "shell" ? <input value={jobCommand} onChange={(event) => setJobCommand(event.target.value)} disabled={loading} /> : null}
        {jobTaskType === "extract" ? <input value={jobSourcePath} onChange={(event) => setJobSourcePath(event.target.value)} disabled={loading} /> : null}
        {jobTaskType === "browser" ? (
          <>
            <input value={jobUrl} onChange={(event) => setJobUrl(event.target.value)} disabled={loading} />
            <select value={jobBrowserAction} onChange={(event) => setJobBrowserAction(event.target.value)} disabled={loading}>
              <option value="capture_title">Capture page title</option>
              <option value="extract_links">Extract links</option>
            </select>
          </>
        ) : null}

        <button type="button" onClick={handleCreateJob} disabled={loading || !token || !sessionId}>Create Job</button>
        {jobs.length === 0 ? <p className="muted">No jobs yet.</p> : null}
        {jobs.map((job) => (
          <div key={job.job_id} className="session-row">
            <div><strong>{job.title}</strong> ({job.trigger_type})</div>
            <div className="muted">Last status: {job.last_status} | Next run: {job.next_run_at || "n/a"}</div>
            <button type="button" onClick={() => handleToggleJob(job, !job.enabled)} disabled={loading}>
              {job.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>T4.3 OCR and Extraction Pipeline</h2>
        <label htmlFor="extract-path">Source File</label>
        <input id="extract-path" value={extractPath} onChange={(event) => setExtractPath(event.target.value)} disabled={loading} />
        <div className="button-row">
          <button type="button" onClick={handlePickExtractPath} disabled={loading}>Pick File (Native)</button>
          <button type="button" onClick={handleExtractNow} disabled={loading || !token || !sessionId}>Extract Now</button>
        </div>

        {extractions.length === 0 ? <p className="muted">No extraction runs yet.</p> : null}
        {extractions.slice(0, 5).map((item) => (
          <div key={item.extraction_id} className="preview-box">
            <p><strong>{item.extraction_id}</strong> via {item.method}</p>
            <p className="muted">{item.source_path}</p>
            <p>{item.text_excerpt || "(no text extracted)"}</p>
            <p className="muted">Entities: {item.entities.length}</p>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>T4.4 Browser Automation Boundary</h2>
        <p className="muted">Browser tasks are explicit: preview first, then require approval before run. Every execution is visible in the run log.</p>
        {runs.length === 0 ? <p className="muted">No cowork runs yet.</p> : null}
        {runs.slice(0, 6).map((run) => (
          <div key={run.run_id} className="session-row">
            <div><strong>{run.run_id}</strong> [{run.task_type}]</div>
            <div>{run.summary}</div>
            <div className="muted">Status: {run.status} | Trigger: {run.trigger}</div>
          </div>
        ))}
        <button type="button" onClick={() => refreshCoworkData(token)} disabled={!token || loading}>Refresh Cowork Data</button>
      </section>
    </main>
  );
}
