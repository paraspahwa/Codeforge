"use client";

import { createContext, useContext, useMemo } from "react";

import { canWriteSession, isViewOnlySession } from "@codeforge/shared/sessions";

const SessionContext = createContext({
  currentSession: null,
  sessionWritable: true,
  isViewOnly: false,
});

export function SessionProvider({ sessionId, sessions, children }) {
  const currentSession = useMemo(
    () => sessions.find((entry) => entry.session_id === sessionId) || null,
    [sessionId, sessions],
  );
  const sessionWritable = canWriteSession(currentSession);
  const value = useMemo(
    () => ({
      currentSession,
      sessionWritable,
      isViewOnly: isViewOnlySession(currentSession),
    }),
    [currentSession, sessionWritable],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionAccess() {
  return useContext(SessionContext);
}
