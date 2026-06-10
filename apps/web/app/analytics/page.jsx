"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@codeforge/ui";

import Sparkline from "../../components/Sparkline";

import {
  getCoworkReliability,
  getCoworkReliabilityHistory,
  getRoutingBenchmark,
  getRoutingBenchmarkTrends,
  getSynthesisRolloutPlan,
  getSynthesisRolloutValidation,
  getUsageSummary,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useToast } from "../../lib/toast-context";

export default function AnalyticsPage() {
  const { token, ready } = useAuth();
  const toast = useToast();

  const [usage, setUsage] = useState(null);
  const [benchmarkSuite, setBenchmarkSuite] = useState("policy");
  const [benchmark, setBenchmark] = useState(null);
  const [benchmarkTrends, setBenchmarkTrends] = useState(null);
  const [loadingBenchmark, setLoadingBenchmark] = useState(false);
  const [coworkReliability, setCoworkReliability] = useState(null);
  const [coworkHistory, setCoworkHistory] = useState(null);
  const [rolloutEnvironment, setRolloutEnvironment] = useState("local");
  const [rolloutPlan, setRolloutPlan] = useState(null);
  const [rolloutValidation, setRolloutValidation] = useState(null);
  const [loadingRollout, setLoadingRollout] = useState(false);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    getUsageSummary(token)
      .then(setUsage)
      .catch((error) => toast.push(error.message));
    Promise.all([getCoworkReliability(token), getCoworkReliabilityHistory(token, 30)])
      .then(([reliability, history]) => {
        setCoworkReliability(reliability);
        setCoworkHistory(history);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  async function loadBenchmark(suite = benchmarkSuite) {
    setLoadingBenchmark(true);
    try {
      const [result, trends] = await Promise.all([
        getRoutingBenchmark(token, suite),
        getRoutingBenchmarkTrends(token, suite, 20),
      ]);
      setBenchmark(result);
      setBenchmarkTrends(trends);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoadingBenchmark(false);
    }
  }

  async function loadRollout(environment = rolloutEnvironment) {
    setLoadingRollout(true);
    try {
      const [plan, validation] = await Promise.all([
        getSynthesisRolloutPlan(token, environment),
        getSynthesisRolloutValidation(token, environment),
      ]);
      setRolloutPlan(plan);
      setRolloutValidation(validation);
    } catch (error) {
      toast.push(error.message);
    } finally {
      setLoadingRollout(false);
    }
  }

  if (ready && !token) {
    return null;
  }

  if (!ready) {
    return (
      <section className="panel">
        <Skeleton style={{ height: "2rem", marginBottom: "1rem" }} />
        <div className="stats-grid">
          <Skeleton style={{ height: "5rem" }} />
          <Skeleton style={{ height: "5rem" }} />
          <Skeleton style={{ height: "5rem" }} />
        </div>
      </section>
    );
  }

  const reliabilityTrend =
    coworkHistory?.snapshots?.map((snapshot) => Math.round((1 - (snapshot.failure_rate ?? 0)) * 100)) || [];

  return (
    <div className="stack">
      <section className="stats-grid">
        <article className="stat-card">
          <p className="small">Requests (this month)</p>
          <h2>{usage?.requests_used_in_period ?? usage?.total_requests ?? "-"}</h2>
          <Sparkline
            values={[
              usage?.requests_used_in_period ?? 0,
              usage?.requests_remaining ?? 0,
              usage?.request_limit ?? 0,
            ]}
          />
          <p className="small">
            {usage
              ? `${usage.requests_remaining} of ${usage.request_limit} remaining on ${usage.plan_id}`
              : ""}
          </p>
        </article>
        <article className="stat-card">
          <p className="small">Input Tokens</p>
          <h2>{usage?.input_tokens ?? "-"}</h2>
        </article>
        <article className="stat-card">
          <p className="small">Output Tokens</p>
          <h2>{usage?.output_tokens ?? "-"}</h2>
        </article>
        <article className="stat-card">
          <p className="small">Cost (USD)</p>
          <h2>{usage ? usage.total_cost_usd.toFixed(4) : "-"}</h2>
        </article>
        <article className="stat-card">
          <p className="small">Avg Latency</p>
          <h2>{usage ? `${Math.round(usage.avg_latency_ms)} ms` : "-"}</h2>
        </article>
        <article className="stat-card">
          <p className="small">Cowork Reliability</p>
          <h2>
            {coworkReliability
              ? `${Math.round((1 - (coworkReliability.recent_failure_rate ?? 0)) * 100)}%`
              : "-"}
          </h2>
          <Sparkline values={reliabilityTrend.slice(-12)} />
          <p className="small">
            {coworkReliability
              ? `failures ${coworkReliability.recent_failed_runs ?? 0}/${coworkReliability.recent_runs ?? 0} | snapshots ${coworkHistory?.snapshots?.length ?? 0}`
              : ""}
          </p>
        </article>
      </section>

      <section className="panel">
        <h2>Routing Benchmark</h2>
        <div className="replay-toolbar">
          <select
            aria-label="Benchmark suite"
            value={benchmarkSuite}
            onChange={(event) => setBenchmarkSuite(event.target.value)}
            disabled={loadingBenchmark}
          >
            <option value="policy">policy</option>
            <option value="repository">repository</option>
            <option value="all">all</option>
          </select>
          <button type="button" onClick={() => loadBenchmark(benchmarkSuite)} disabled={loadingBenchmark}>
            {loadingBenchmark ? "Running..." : "Run Benchmark"}
          </button>
        </div>

        {benchmark ? (
          <>
            <p className="small mt-8">
              pass rate: {Math.round((benchmark.pass_rate ?? 0) * 100)}% | low confidence:{" "}
              {Math.round((benchmark.low_confidence_rate ?? 0) * 100)}% | fallback:{" "}
              {Math.round((benchmark.fallback_usage_rate ?? 0) * 100)}% | est. cost: $
              {(benchmark.total_estimated_cost_usd ?? 0).toFixed(4)}
            </p>
            {benchmarkTrends ? (
              <p className="small">
                baseline pass:{" "}
                {benchmarkTrends.baseline
                  ? `${Math.round((benchmarkTrends.baseline.pass_rate ?? 0) * 100)}%`
                  : "not set"}{" "}
                | regression alerts (last 10): {benchmarkTrends.regression_alerts_last_10}
              </p>
            ) : null}
            {benchmarkTrends?.runs?.length ? (
              <div className="benchmark-list">
                {benchmarkTrends.runs.slice(0, 5).map((run) => (
                  <div className="benchmark-row" key={run.run_id}>
                    <div className="small">{new Date(run.created_at).toLocaleString()}</div>
                    <div className="small">
                      pass {Math.round((run.pass_rate ?? 0) * 100)}% | fallback{" "}
                      {Math.round((run.fallback_usage_rate ?? 0) * 100)}%
                    </div>
                    <div className={`small ${run.regression_alert ? "benchmark-fail" : "benchmark-pass"}`}>
                      {run.regression_alert ? `regression: ${run.regression_reason || "detected"}` : "ok"}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="benchmark-list">
              {(benchmark.results ?? []).map((item) => (
                <div className="benchmark-row" key={`${item.prompt}-${item.expected_intent}`}>
                  <div className="small">{item.prompt}</div>
                  <div className="small">
                    {item.actual_intent} / {item.actual_tier} /{" "}
                    {Math.round((item.confidence_score ?? 0) * 100)}%
                  </div>
                  <div className={`small ${item.passed ? "benchmark-pass" : "benchmark-fail"}`}>
                    {item.passed ? "pass" : "fail"}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="small mt-8">Run a benchmark to see routing quality results.</p>
        )}
      </section>

      <section className="panel">
        <h2>Synthesis Rollout</h2>
        <div className="replay-toolbar">
          <select
            aria-label="Rollout environment"
            value={rolloutEnvironment}
            onChange={(event) => setRolloutEnvironment(event.target.value)}
            disabled={loadingRollout}
          >
            <option value="local">local</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
          <button type="button" onClick={() => loadRollout(rolloutEnvironment)} disabled={loadingRollout}>
            {loadingRollout ? "Loading..." : "Load Plan"}
          </button>
        </div>

        {rolloutPlan ? (
          <>
            <p className="small mt-8">Recommended provider: {rolloutPlan.recommended_provider}</p>
            <p className="small">Strategy: {rolloutPlan.strategy}</p>
            <p className="small">
              Release readiness:{" "}
              {rolloutValidation ? (rolloutValidation.is_ready_for_release ? "ready" : "blocked") : "-"}{" "}
              ({rolloutValidation ? `${rolloutValidation.readiness_score}%` : "-"})
            </p>
            <p className="small">
              Missing required env:{" "}
              {(rolloutPlan.providers || [])
                .flatMap((provider) => provider.required_env || [])
                .filter((item) => item.required && !item.set)
                .map((item) => item.name)
                .join(", ") || "none"}
            </p>
            {rolloutValidation?.blockers?.length ? (
              <ul>
                {rolloutValidation.blockers.map((blocker) => (
                  <li className="small" key={blocker}>
                    {blocker}
                  </li>
                ))}
              </ul>
            ) : null}
            <ul>
              {(rolloutPlan.automation_steps || []).map((step) => (
                <li className="small" key={step}>
                  {step}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="small mt-8">Load a plan to inspect rollout readiness per environment.</p>
        )}
      </section>
    </div>
  );
}
