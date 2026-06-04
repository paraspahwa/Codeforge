"use client";

import { useMemo, useState } from "react";

import {
  createBillingOrder,
  createSession,
  decideProposal,
  devLogin,
  applyGitConflictAssist,
  getGitConflictGuide,
  getProposal,
  getBillingSubscription,
  getRoutingBenchmark,
  getSynthesisRolloutPlan,
  getUsageSummary,
  listBillingPlans,
  listMessages,
  listSessions,
  sendMessage,
  verifyBillingPayment,
  streamSession,
} from "../lib/api";

export default function HomePage() {
  const [userId, setUserId] = useState("paras");
  const [token, setToken] = useState(null);
  const [projectPath, setProjectPath] = useState("c:/Users/paras/Codeforge");
  const [sessionId, setSessionId] = useState(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastModel, setLastModel] = useState("-");
  const [lastConfidence, setLastConfidence] = useState({
    score: null,
    label: "-",
    reviewRequired: false,
    tier: "-",
    fallbackUsed: false,
  });
  const [usage, setUsage] = useState({
    total_requests: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_cost_usd: 0,
    avg_latency_ms: 0,
  });
  const [plans, setPlans] = useState([]);
  const [orderInfo, setOrderInfo] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [agentEvents, setAgentEvents] = useState([]);
  const [pendingProposal, setPendingProposal] = useState(null);
  const [routingBenchmark, setRoutingBenchmark] = useState(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const [rolloutEnvironment, setRolloutEnvironment] = useState("local");
  const [rolloutPlan, setRolloutPlan] = useState(null);
  const [loadingRolloutPlan, setLoadingRolloutPlan] = useState(false);
  const [conflictTargetBranch, setConflictTargetBranch] = useState("main");
  const [conflictGuide, setConflictGuide] = useState(null);
  const [conflictStrategy, setConflictStrategy] = useState("ours");
  const [conflictPaths, setConflictPaths] = useState("");
  const [conflictApplyResult, setConflictApplyResult] = useState(null);

  const canSend = useMemo(() => token && sessionId && prompt.trim().length > 0 && !loading, [token, sessionId, prompt, loading]);

  async function refreshSessions(authToken) {
    const sessions = await listSessions(authToken);
    setSessionHistory(sessions.map((session) => ({ session_id: session.session_id, created_at: session.created_at })));
  }

  async function refreshUsage(authToken) {
    const summary = await getUsageSummary(authToken);
    setUsage(summary);
  }

  async function refreshSubscription(authToken) {
    const status = await getBillingSubscription(authToken);
    setSubscription(status);
  }

  async function refreshRoutingBenchmark(authToken) {
    setLoadingBenchmark(true);
    try {
      const benchmark = await getRoutingBenchmark(authToken);
      setRoutingBenchmark(benchmark);
    } catch {
      setRoutingBenchmark(null);
    } finally {
      setLoadingBenchmark(false);
    }
  }

  async function refreshRolloutPlan(authToken, environment = rolloutEnvironment) {
    setLoadingRolloutPlan(true);
    try {
      const plan = await getSynthesisRolloutPlan(authToken, environment);
      setRolloutPlan(plan);
    } catch (error) {
      setRolloutPlan(null);
      alert(error.message);
    } finally {
      setLoadingRolloutPlan(false);
    }
  }

  async function handleLoadConflictGuide() {
    if (!token || !sessionId) {
      alert("Login and select a session first");
      return;
    }
    if (!conflictTargetBranch.trim()) {
      alert("Target branch is required");
      return;
    }

    setLoading(true);
    try {
      const guide = await getGitConflictGuide(token, sessionId, conflictTargetBranch.trim());
      setConflictGuide(guide);
      setConflictApplyResult(null);
      setConflictPaths((guide.conflict_files || []).join("\n"));
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyConflictAssist() {
    if (!token || !sessionId) {
      alert("Login and select a session first");
      return;
    }

    setLoading(true);
    try {
      const paths = conflictPaths
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      const result = await applyGitConflictAssist(token, sessionId, {
        target_branch: conflictTargetBranch.trim(),
        strategy: conflictStrategy,
        paths,
      });
      setConflictApplyResult(result);
      if (conflictGuide) {
        setConflictGuide({
          ...conflictGuide,
          conflict_files: result.remaining_conflicts || [],
          has_conflicts: (result.remaining_conflicts || []).length > 0,
        });
      }
      setConflictPaths((result.remaining_conflicts || []).join("\n"));
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
      document.body.appendChild(script);
    });
  }

  async function handleLogin() {
    setLoading(true);
    try {
      const nextToken = await devLogin(userId.trim());
      setToken(nextToken);
      await refreshSessions(nextToken);
      await refreshUsage(nextToken);
      await refreshSubscription(nextToken);
      await refreshRoutingBenchmark(nextToken);
      await refreshRolloutPlan(nextToken, rolloutEnvironment);
      const availablePlans = await listBillingPlans();
      setPlans(availablePlans);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrder(plan) {
    if (!token) {
      alert("Please login first");
      return;
    }
    setLoading(true);
    try {
      const order = await createBillingOrder(token, plan.plan_id, plan.amount_inr);
      setOrderInfo(order);
      await loadRazorpayScript();

      if (!window.Razorpay) {
        throw new Error("Razorpay checkout is unavailable");
      }

      const checkout = new window.Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        currency: order.currency,
        amount: plan.amount_inr * 100,
        name: "CodeForge",
        description: `${plan.name} subscription`,
        handler: async (response) => {
          await verifyBillingPayment(token, {
            order_id: response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            plan_id: plan.plan_id,
            amount_inr: plan.amount_inr,
          });
          await refreshSubscription(token);
          await refreshUsage(token);
          await refreshSessions(token);
        },
        prefill: {
          name: userId,
          email: `${userId}@codeforge.local`,
        },
        theme: {
          color: "#2563eb",
        },
      });

      checkout.open();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectSession(nextSessionId) {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const stored = await listMessages(nextSessionId, token);
      setSessionId(nextSessionId);
      setMessages(
        stored.map((msg) => ({
          id: msg.message_id,
          role: msg.role,
          content: msg.content,
        }))
      );
      setAgentEvents([]);
      setPendingProposal(null);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSession() {
    if (!token) {
      alert("Please login first");
      return;
    }
    setLoading(true);
    try {
      const result = await createSession(projectPath, token);
      setSessionId(result.session_id);
      setMessages([]);
      await refreshSessions(token);
      await refreshUsage(token);
      await refreshRoutingBenchmark(token);
      await refreshRolloutPlan(token, rolloutEnvironment);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendPrompt(event) {
    event.preventDefault();
    if (!sessionId || !token || !prompt.trim()) {
      return;
    }

    const userText = prompt.trim();
    setPrompt("");
    setLoading(true);

    const userMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: userText,
    };

    const assistantMessage = {
      id: `a_${Date.now()}`,
      role: "assistant",
      content: "",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const sent = await sendMessage(sessionId, userText, token);
      setLastModel(sent.model_used);
      setAgentEvents((prev) => [
        `route: ${sent.intent ?? "unknown"} via ${sent.model_used ?? "unknown"}`,
        `why: ${sent.routing_reason ?? "no reason provided"}`,
        `confidence: ${sent.confidence_label ?? "unknown"} (${Math.round((sent.confidence_score ?? 0) * 100)}%)`,
        sent.review_required ? "review: human review recommended" : "review: auto-confidence acceptable",
        ...prev,
      ].slice(0, 8));
      setLastConfidence({
        score: sent.confidence_score,
        label: sent.confidence_label ?? "unknown",
        reviewRequired: Boolean(sent.review_required),
        tier: sent.routing_tier ?? "unknown",
        fallbackUsed: Boolean(sent.fallback_used),
      });

      const source = streamSession(sessionId, token, (evt) => {
        if (evt.type === "run_started") {
          setAgentEvents((prev) => [
            `run: ${evt.payload?.intent ?? "unknown"} via ${evt.payload?.model ?? "unknown"}`,
            evt.payload?.reason ? `why: ${evt.payload.reason}` : null,
            evt.payload?.confidence_label
              ? `confidence: ${evt.payload.confidence_label} (${Math.round((evt.payload.confidence_score ?? 0) * 100)}%)`
              : null,
            evt.payload?.review_required ? "review: human review recommended" : null,
            ...prev,
          ].filter(Boolean).slice(0, 8));
          setLastConfidence((prev) => ({
            ...prev,
            score: evt.payload?.confidence_score ?? prev.score,
            label: evt.payload?.confidence_label ?? prev.label,
            reviewRequired: Boolean(evt.payload?.review_required),
            tier: evt.payload?.routing_tier ?? prev.tier,
            fallbackUsed: Boolean(evt.payload?.fallback_used),
          }));
        }

        if (evt.type === "token") {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, content: msg.content + (evt.payload?.content ?? evt.content ?? "") }
                : msg
            )
          );
        }

        if (evt.type === "tool_call") {
          setAgentEvents((prev) => [`tool: ${evt.payload?.tool} (${evt.payload?.status})`, ...prev].slice(0, 8));
        }

        if (evt.type === "diff") {
          setAgentEvents((prev) => [`diff: ${evt.payload?.file}`, ...prev].slice(0, 8));
          if (evt.payload?.proposal_id) {
            setPendingProposal({
              proposal_id: evt.payload.proposal_id,
              target_file: evt.payload.file,
              patch_preview: evt.payload.patch,
              status: "pending",
            });
          }
        }

        if (evt.type === "approval_request") {
          setAgentEvents((prev) => [`approval: ${evt.payload?.message}`, ...prev].slice(0, 8));
          if (evt.payload?.proposal_id) {
            getProposal(sessionId, evt.payload.proposal_id, token)
              .then((proposal) => setPendingProposal(proposal))
              .catch(() => undefined);
          }
        }

        if (evt.type === "tool_result") {
          setAgentEvents((prev) => [`verify: ${evt.payload?.message}`, ...prev].slice(0, 8));
        }

        if (evt.type === "complete") {
          source.close();
          refreshUsage(token).catch(() => undefined);
          setLoading(false);
        }
      });

      source.onerror = () => {
        source.close();
        setLoading(false);
      };
    } catch (error) {
      alert(error.message);
      setLoading(false);
    }
  }

  async function handleProposalDecision(action) {
    if (!token || !sessionId || !pendingProposal?.proposal_id) {
      return;
    }

    setLoading(true);
    try {
      const result = await decideProposal(sessionId, pendingProposal.proposal_id, action, token);
      setPendingProposal((prev) => (prev ? { ...prev, status: result.status } : prev));
      setAgentEvents((prev) => [`proposal ${result.status}: ${result.target_file}`, ...prev].slice(0, 8));
      if (action === "approve") {
        const stored = await listMessages(sessionId, token);
        setMessages(
          stored.map((msg) => ({
            id: msg.message_id,
            role: msg.role,
            content: msg.content,
          }))
        );
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>CodeForge Web Dashboard</h1>
      <p className="small">Web app first: auth + persisted sessions/messages + streaming API.</p>

      <section className="stats-grid">
        <article className="stat-card">
          <p className="small">Requests</p>
          <h2>{usage.total_requests}</h2>
        </article>
        <article className="stat-card">
          <p className="small">Input Tokens</p>
          <h2>{usage.input_tokens}</h2>
        </article>
        <article className="stat-card">
          <p className="small">Output Tokens</p>
          <h2>{usage.output_tokens}</h2>
        </article>
        <article className="stat-card">
          <p className="small">Cost (USD)</p>
          <h2>{usage.total_cost_usd.toFixed(4)}</h2>
        </article>
        <article className="stat-card">
          <p className="small">Avg Latency</p>
          <h2>{Math.round(usage.avg_latency_ms)} ms</h2>
        </article>
        <article className="stat-card">
          <p className="small">Routing Confidence</p>
          <h2>
            {lastConfidence.score === null ? "-" : `${Math.round(lastConfidence.score * 100)}%`} ({lastConfidence.label})
          </h2>
          <p className="small">
            tier: {lastConfidence.tier} | fallback: {lastConfidence.fallbackUsed ? "yes" : "no"}
          </p>
          {lastConfidence.reviewRequired ? <p className="small">Human review recommended</p> : null}
        </article>
        <article className="stat-card">
          <p className="small">Routing Benchmark</p>
          <h2>
            {routingBenchmark ? `${Math.round((routingBenchmark.pass_rate ?? 0) * 100)}%` : "-"}
          </h2>
          <p className="small">
            fallback: {routingBenchmark ? `${Math.round((routingBenchmark.fallback_usage_rate ?? 0) * 100)}%` : "-"}
          </p>
          <button type="button" onClick={() => token && refreshRoutingBenchmark(token)} disabled={!token || loadingBenchmark}>
            {loadingBenchmark ? "Refreshing..." : "Refresh"}
          </button>
        </article>
      </section>

      {subscription ? (
        <section className="panel subscription-banner">
          <strong>Subscription:</strong> {subscription.plan_id} ({subscription.status})
        </section>
      ) : null}

      <section className="grid">
        <article className="panel">
          <h2>Synthesis Rollout Plan</h2>
          <label className="small" htmlFor="rollout-environment">
            Environment
          </label>
          <select
            id="rollout-environment"
            value={rolloutEnvironment}
            onChange={(event) => setRolloutEnvironment(event.target.value)}
            disabled={!token || loadingRolloutPlan}
          >
            <option value="local">local</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
          <button
            type="button"
            onClick={() => token && refreshRolloutPlan(token, rolloutEnvironment)}
            disabled={!token || loadingRolloutPlan}
          >
            {loadingRolloutPlan ? "Loading..." : "Load Plan"}
          </button>

          {rolloutPlan ? (
            <>
              <p className="small">Recommended provider: {rolloutPlan.recommended_provider}</p>
              <p className="small">Strategy: {rolloutPlan.strategy}</p>
              <p className="small">
                Missing required env:{" "}
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
            </>
          ) : (
            <p className="small">Load a plan to see environment-specific rollout and secret steps.</p>
          )}
        </article>

        <article className="panel">
          <h2>Git Conflict Assistant</h2>
          <label className="small" htmlFor="conflict-branch">
            Target Branch
          </label>
          <input
            id="conflict-branch"
            value={conflictTargetBranch}
            onChange={(event) => setConflictTargetBranch(event.target.value)}
            disabled={!token || loading}
          />
          <button type="button" onClick={handleLoadConflictGuide} disabled={!token || !sessionId || loading}>
            Load Conflict Guide
          </button>

          {conflictGuide ? (
            <>
              <p className="small">Current: {conflictGuide.current_branch}</p>
              <p className="small">Conflicts: {(conflictGuide.conflict_files || []).length}</p>
              <ul>
                {(conflictGuide.steps || []).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <label className="small" htmlFor="conflict-strategy">
                Assisted Apply Strategy
              </label>
              <select
                id="conflict-strategy"
                value={conflictStrategy}
                onChange={(event) => setConflictStrategy(event.target.value)}
                disabled={loading}
              >
                <option value="ours">ours</option>
                <option value="theirs">theirs</option>
              </select>
              <label className="small" htmlFor="conflict-paths">
                Paths (one per line, blank = all unresolved)
              </label>
              <textarea
                id="conflict-paths"
                rows={5}
                value={conflictPaths}
                onChange={(event) => setConflictPaths(event.target.value)}
                disabled={loading}
              />
              <button type="button" onClick={handleApplyConflictAssist} disabled={loading}>
                Apply Strategy and Stage
              </button>
            </>
          ) : (
            <p className="small">Load the guide first to inspect unresolved conflicts.</p>
          )}

          {conflictApplyResult ? (
            <>
              <p className="small">Applied: {(conflictApplyResult.applied_paths || []).length} files</p>
              <p className="small">Remaining: {(conflictApplyResult.remaining_conflicts || []).length} files</p>
            </>
          ) : null}
        </article>
      </section>

      <div className="grid">
        <section className="panel">
          <h2>Login</h2>
          <label className="small" htmlFor="userId">
            Dev User ID
          </label>
          <input id="userId" value={userId} onChange={(event) => setUserId(event.target.value)} disabled={loading} />
          <div className="mt-8">
            <button onClick={handleLogin} disabled={loading || !userId.trim()}>
              {token ? "Re-login" : "Login"}
            </button>
          </div>
          <p className="small mt-8">Token: {token ? "active" : "not logged in"}</p>

          <hr className="divider" />

          <h2>Session</h2>
          <label className="small" htmlFor="projectPath">
            Project Path
          </label>
          <input
            id="projectPath"
            value={projectPath}
            onChange={(event) => setProjectPath(event.target.value)}
            disabled={loading}
          />
          <div className="mt-8">
            <button onClick={handleCreateSession} disabled={loading || !token || !projectPath.trim()}>
              {sessionId ? "Recreate Session" : "Create Session"}
            </button>
          </div>
          <p className="small mt-8">Session ID: {sessionId ?? "Not created"}</p>
          <p className="small">Last Model: {lastModel}</p>

          <h3>Recent Sessions</h3>
          <div className="session-list">
            {sessionHistory.length === 0 ? <p className="small">No saved sessions.</p> : null}
            {sessionHistory.map((entry) => (
              <button
                key={entry.session_id}
                className="ghost-btn"
                type="button"
                onClick={() => handleSelectSession(entry.session_id)}
                disabled={loading}
              >
                {entry.session_id}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Chat</h2>
          <div className="chat-log">
            {messages.length === 0 ? <p className="small">No messages yet.</p> : null}
            {messages.map((msg) => (
              <div className={`msg ${msg.role}`} key={msg.id}>
                <strong>{msg.role === "user" ? "You" : "CodeForge"}</strong>
                <div>{msg.content || "..."}</div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendPrompt} className="mt-9">
            <textarea
              rows={3}
              placeholder="Ask CodeForge to refactor, explain, or debug..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={!token || !sessionId || loading}
            />
            <div className="mt-6">
              <button type="submit" disabled={!canSend}>
                {loading ? "Streaming..." : "Send"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <h2>Billing</h2>
          <p className="small">Razorpay foundation: create order and pass order_id/key_id to checkout in next step.</p>
          <div className="plan-list">
            {plans.length === 0 ? <p className="small">Login to load plans.</p> : null}
            {plans.map((plan) => (
              <div className="plan-row" key={plan.plan_id}>
                <div>
                  <strong>{plan.name}</strong>
                  <div className="small">INR {plan.amount_inr} • {plan.request_limit} requests/month</div>
                </div>
                <button type="button" onClick={() => handleCreateOrder(plan)} disabled={!token || loading}>
                  Create Order
                </button>
              </div>
            ))}
          </div>
          {orderInfo ? (
            <div className="order-card mt-8">
              <div className="small">Provider: {orderInfo.provider}</div>
              <div className="small">Order ID: {orderInfo.order_id}</div>
              <div className="small">Key ID: {orderInfo.key_id}</div>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <h2>Agent Activity</h2>
          {pendingProposal ? (
            <div className="proposal-card">
              <div className="small">Proposal: {pendingProposal.proposal_id}</div>
              <div className="small">File: {pendingProposal.target_file}</div>
              <div className="small">Status: {pendingProposal.status}</div>
              <pre className="proposal-preview">{pendingProposal.patch_preview}</pre>
              {pendingProposal.status === "pending" ? (
                <div className="proposal-actions">
                  <button type="button" onClick={() => handleProposalDecision("approve")} disabled={loading}>
                    Approve
                  </button>
                  <button type="button" className="ghost-btn inline-btn" onClick={() => handleProposalDecision("reject")} disabled={loading}>
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="session-list">
            {agentEvents.length === 0 ? <p className="small">No agent events yet.</p> : null}
            {agentEvents.map((entry) => (
              <div key={entry} className="small">
                {entry}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Routing Benchmark</h2>
          {!token ? <p className="small">Login to load benchmark results.</p> : null}
          {token && !routingBenchmark ? <p className="small">No benchmark snapshot loaded yet.</p> : null}
          {routingBenchmark ? (
            <>
              <p className="small">
                pass rate: {Math.round((routingBenchmark.pass_rate ?? 0) * 100)}% | low confidence: {Math.round((routingBenchmark.low_confidence_rate ?? 0) * 100)}% | estimated cost: ${(routingBenchmark.total_estimated_cost_usd ?? 0).toFixed(4)}
              </p>
              <div className="benchmark-list">
                {(routingBenchmark.results ?? []).map((item) => (
                  <div className="benchmark-row" key={`${item.prompt}-${item.expected_intent}`}>
                    <div className="small">{item.prompt}</div>
                    <div className="small">
                      {item.actual_intent} / {item.actual_tier} / {Math.round((item.confidence_score ?? 0) * 100)}%
                    </div>
                    <div className={`small ${item.passed ? "benchmark-pass" : "benchmark-fail"}`}>
                      {item.passed ? "pass" : "fail"}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
