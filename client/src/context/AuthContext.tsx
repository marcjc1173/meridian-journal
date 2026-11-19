import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { AuthStatus } from '../types';

export const TAB_UNLOCKED_KEY = 'meridian_tab_unlocked';
export const LAST_ACTIVITY_KEY = 'meridian_last_activity';

interface AuthContextValue {
  status: AuthStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  markUnlocked: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const lockingRef = useRef(false);

  const markUnlocked = useCallback(() => {
    sessionStorage.setItem(TAB_UNLOCKED_KEY, '1');
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }, []);

  const logout = useCallback(async () => {
    sessionStorage.removeItem(TAB_UNLOCKED_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    try {
      await api.logout();
    } catch {
      // ignore network error on logout
    }
    const s = await api.getAuthStatus().catch(() => null);
    if (s) setStatus(s);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getAuthStatus();

      // Enforce lock-on-close if this is a freshly opened tab/PWA without an active tab unlock
      if (s.authenticated && s.lockOnClose && !sessionStorage.getItem(TAB_UNLOCKED_KEY)) {
        await api.logout().catch(() => {});
        const locked = await api.getAuthStatus();
        setStatus(locked);
        return;
      }

      // Enforce inactivity timeout if returning after the timeout already elapsed
      if (s.authenticated && s.autoLockMinutes > 0) {
        const lastRaw = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || '0');
        if (lastRaw > 0 && Date.now() - lastRaw >= s.autoLockMinutes * 60_000) {
          await api.logout().catch(() => {});
          localStorage.removeItem(LAST_ACTIVITY_KEY);
          sessionStorage.removeItem(TAB_UNLOCKED_KEY);
          const locked = await api.getAuthStatus();
          setStatus(locked);
          return;
        }
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      }

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

  // Monitor user activity & enforce inactivity auto-lock
  useEffect(() => {
    const minutes = status?.autoLockMinutes || 0;
    if (!status?.authenticated || minutes <= 0) return;

    const timeoutMs = minutes * 60_000;
    let lastWrite = Date.now();
    localStorage.setItem(LAST_ACTIVITY_KEY, String(lastWrite));

    const touchActivity = () => {
      const now = Date.now();
      if (now - lastWrite >= 5000) {
        lastWrite = now;
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      }
    };

    const checkTimeout = () => {
      if (lockingRef.current) return;
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || String(lastWrite));
      if (Date.now() - last >= timeoutMs) {
        lockingRef.current = true;
        logout().finally(() => {
          lockingRef.current = false;
        });
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTimeout();
      }
    };

    const events: (keyof WindowEventMap)[] = [
      'pointerdown',
      'keydown',
      'touchstart',
      'scroll',
    ];
    events.forEach((ev) => window.addEventListener(ev, touchActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = window.setInterval(checkTimeout, 15_000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, touchActivity));
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [status?.authenticated, status?.autoLockMinutes, logout]);

  return (
    <AuthContext.Provider value={{ status, loading, refresh, logout, markUnlocked }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
