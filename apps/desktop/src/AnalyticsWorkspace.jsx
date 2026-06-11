import { useEffect, useState } from "react";

import {
  getCoworkReliability,
  getCoworkReliabilityHistory,
  getRoutingBenchmark,
  getRoutingBenchmarkTrends,
  getSynthesisRolloutPlan,
  getSynthesisRolloutValidation,
  getUsageSummary,
} from "./api";
import { useDesktopAuth } from "./DesktopAuthContext";
import { useDesktopNotify } from "./useDesktopNotify";

export default function AnalyticsWorkspace() {
  const { token } = useDesktopAuth();
  const { errorMessage, reportError } = useDesktopNotify();

  const [usage, setUsage] = useState(null);
  const [benchmarkSuite, setBenchmarkSuite] = useState("policy");
  const [benchmark, setBenchmark] = useState(null);
  const [benchmarkTrends, setBenchmarkTrends] = useState(null);
  const [coworkReliability, setCoworkReliability] = useState(null);
  const [coworkHistory, setCoworkHistory] = useState(null);
  const [rolloutEnvironment, setRolloutEnvironment] = useState("local");
  const [rolloutPlan, setRolloutPlan] = useState(null);
  const [rolloutValidation, setRolloutValidation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    getUsageSummary(token).then(setUsage).catch((error) => reportError(error.message));
    Promise.all([getCoworkReliability(token), getCoworkReliabilityHistory(token, 30)])
      .then(([reliability, history]) => {
        setCoworkReliability(reliability);
        setCoworkHistory(history);
      })
      .catch(() => undefined);
  }, [token, reportError]);

  useEffect(() => {
    if (!token) {
      return;
    }
    loadBenchmark().catch(() => undefined);
    loadRollout().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, benchmarkSuite, rolloutEnvironment]);

  async function loadBenchmark() {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const [result, trends] = await Promise.all([
        getRoutingBenchmark(token, benchmarkSuite),
        getRoutingBenchmarkTrends(token, benchmarkSuite, 20),
      ]);
      setBenchmark(result);
      setBenchmarkTrends(trends);
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRollout() {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const [plan, validation] = await Promise.all([
        getSynthesisRolloutPlan(token, rolloutEnvironment),
        getSynthesisRolloutValidation(token, rolloutEnvironment),
      ]);
      setRolloutPlan(plan);
      setRolloutValidation(validation);
    } catch (error) {
      reportError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="desktop-main">
      <h1>Analytics</h1>
      <p className="muted">Usage, routing benchmarks, cowork reliability, and synthesis rollout — mirrors web /analytics.</p>
      {errorMessage ? <div className="status error">{errorMessage}</div> : null}

      <section className="card">
        <h2>Usage</h2>
        {usage ? (
          <div className="preview-box">
            <p>
              <strong>Plan:</strong> {usage.plan_id || "free"} ({usage.plan_source || "default"})
            </p>
            <p>
              Requests: {usage.requests_used_in_period ?? usage.total_requests} / {usage.request_limit} (
              {usage.requests_remaining} remaining)
            </p>
            <p className="muted small">Period resets: {usage.period_reset_at || "n/a"}</p>
          </div>
        ) : (
          <p className="muted">Sign in to load usage.</p>
        )}
      </section>

      <section className="card">
        <h2>Routing benchmark</h2>
        <div className="button-row">
          <select value={benchmarkSuite} onChange={(event) => setBenchmarkSuite(event.target.value)} disabled={!token || loading}>
            <option value="policy">policy</option>
            <option value="repository">repository</option>
            <option value="all">all</option>
          </select>
          <button type="button" onClick={loadBenchmark} disabled={!token || loading}>
            Refresh
          </button>
        </div>
        {benchmark ? (
          <div className="preview-box">
            <p>Pass rate: {Math.round((benchmark.pass_rate || 0) * 100)}%</p>
            <p>Fallback usage: {Math.round((benchmark.fallback_usage_rate || 0) * 100)}%</p>
            <p>Low confidence: {Math.round((benchmark.low_confidence_rate || 0) * 100)}%</p>
            <p>Regression alerts (last 10): {benchmarkTrends?.regression_alerts_last_10 ?? 0}</p>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>Cowork reliability</h2>
        {coworkReliability ? (
          <div className="preview-box">
            <p>Alert: {coworkReliability.reliability_alert ? "yes" : "no"}</p>
            <p>Failure rate: {Math.round((coworkReliability.recent_failure_rate || 0) * 100)}%</p>
            <p>Circuit broken jobs: {coworkReliability.circuit_broken_jobs}</p>
            <p>Snapshots: {coworkHistory?.snapshots?.length ?? 0}</p>
          </div>
        ) : (
          <p className="muted">No reliability data yet.</p>
        )}
      </section>

      <section className="card">
        <h2>Synthesis rollout</h2>
        <div className="button-row">
          <select
            value={rolloutEnvironment}
            onChange={(event) => setRolloutEnvironment(event.target.value)}
            disabled={!token || loading}
          >
            <option value="local">local</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
          <button type="button" onClick={loadRollout} disabled={!token || loading}>
            Refresh
          </button>
        </div>
        {rolloutPlan ? (
          <div className="preview-box">
            <p>Recommended provider: {rolloutPlan.recommended_provider}</p>
            <p>Release readiness: {rolloutValidation?.is_ready_for_release ? "ready" : "blocked"}</p>
            <p>Readiness score: {rolloutValidation?.readiness_score ?? 0}%</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
