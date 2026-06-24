"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { StatusBanner } from "@codeforge/ui";

import { getStackStatus } from "./api";

const StackStatusContext = createContext({
  status: null,
  degraded: false,
  refresh: () => undefined,
});

function isDegraded(payload) {
  if (!payload) {
    return true;
  }
  const redisOk = payload.redis?.healthy !== false;
  const vectorOk = payload.vector_store?.healthy !== false;
  const queueOk = payload.task_queue?.healthy !== false;
  return !(redisOk && vectorOk && queueOk);
}

export function StackStatusProvider({ children }) {
  const [status, setStatus] = useState(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const payload = await getStackStatus();
      setStatus(payload);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  const degraded = offline || isDegraded(status);

  const value = useMemo(() => ({ status, degraded, refresh }), [status, degraded, refresh]);

  return (
    <StackStatusContext.Provider value={value}>
      {degraded ? (
        <StatusBanner
          variant="warning"
          title={offline ? "API unreachable" : "Platform degraded"}
          message={
            offline
              ? "Check that the API is running (npm run stack:up). Retrying every minute."
              : "Some services are running in fallback mode. Core chat may still work."
          }
          className="stack-status-banner"
        />
      ) : null}
      {children}
    </StackStatusContext.Provider>
  );
}

export function useStackStatus() {
  return useContext(StackStatusContext);
}
