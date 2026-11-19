import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api';
import type { AuthStatus } from '../types';

interface AuthContextValue {
  status: AuthStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getAuthStatus();
      setStatus(s);
    } catch (err) {
      console.error('Auth status failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.logout();
    await refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ status, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
