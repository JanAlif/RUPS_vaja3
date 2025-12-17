import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const raw = localStorage.getItem("kartografi:user");
        if (raw) {
          setUser(JSON.parse(raw));
        }
        
        const u = await api.verifySession();
        saveUser(u);
      } catch {
        console.log("No valid session found");
        setUser(null);
        localStorage.removeItem("kartografi:user");
      } finally {
        setLoading(false);
      }
    }
    
    checkSession();
  }, []);

  function saveUser(u) {
    setUser(u);
    localStorage.setItem("kartografi:user", JSON.stringify(u));
  }
  
  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
    setUser(null);
    localStorage.removeItem("kartografi:user");
  }, []);

  const register = useCallback(async ({ username, password, points = 0 }) => {
    const u = await api.register({ username, password, points });
    saveUser(u);
    return u;
  }, []);

  const login = useCallback(async ({ username, password }) => {
    const u = await api.login({ username, password });
    saveUser(u);
    return u;
  }, []);

  const value = useMemo(() => ({ user, login, register, logout, loading }), [user, login, register, logout, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}