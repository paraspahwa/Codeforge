"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ShellContext = createContext({
  usage: null,
  setUsage: () => undefined,
  sessionGrant: null,
  setSessionGrant: () => undefined,
});

export function ShellProvider({ children }) {
  const [usage, setUsageState] = useState(null);
  const [sessionGrant, setSessionGrantState] = useState(null);

  const setUsage = useCallback((next) => setUsageState(next), []);
  const setSessionGrant = useCallback((next) => setSessionGrantState(next), []);

  const value = useMemo(
    () => ({ usage, setUsage, sessionGrant, setSessionGrant }),
    [usage, sessionGrant, setUsage, setSessionGrant],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShellBar() {
  return useContext(ShellContext);
}
