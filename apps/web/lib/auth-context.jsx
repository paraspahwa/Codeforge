"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { devLogin } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [userId, setUserId] = useState("");
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedToken = sessionStorage.getItem("codeforge_token");
    const storedUserId = sessionStorage.getItem("codeforge_user_id");
    if (storedToken && storedUserId) {
      setToken(storedToken);
      setUserId(storedUserId);
    }
    setReady(true);
  }, []);

  async function login(nextUserId) {
    const trimmed = nextUserId.trim();
    const nextToken = await devLogin(trimmed);
    setUserId(trimmed);
    setToken(nextToken);
    sessionStorage.setItem("codeforge_token", nextToken);
    sessionStorage.setItem("codeforge_user_id", trimmed);
    return nextToken;
  }

  function logout() {
    setToken(null);
    setUserId("");
    sessionStorage.removeItem("codeforge_token");
    sessionStorage.removeItem("codeforge_user_id");
  }

  return (
    <AuthContext.Provider value={{ userId, token, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
