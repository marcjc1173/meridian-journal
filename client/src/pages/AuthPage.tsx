import React, { useState } from 'react';
import { Fingerprint, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export function AuthPage() {
  const { status, refresh, markUnlocked } = useAuth();
  const isSetup = status ? !status.setupComplete : false;

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSetup) {
      if (password.length < 4) {
        setError('Choose a password or PIN of at least 4 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSetup) {
        await api.setup(password, displayName);
      } else {
        await api.login(password);
      }
      markUnlocked();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError('');
    setPasskeyLoading(true);
    try {
      await api.loginWithPasskey();
      markUnlocked();
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Passkey unlock was cancelled or failed.'
      );
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div
        className="w-full max-w-md rounded-2xl border p-7 sm:p-8 shadow-lg"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex flex-col items-center text-center mb-7">
          <img src="/icon.svg" alt="Meridian" className="h-12 w-12 rounded-xl mb-3" />
          <h1 className="text-2xl font-bold tracking-tight">Meridian</h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
            {isSetup
              ? 'Set up your private journal. Everything stays on your own server.'
              : 'Your private space. Unlock to continue.'}
          </p>
        </div>

        {/* Passkey unlock button if registered */}
        {!isSetup && status?.hasPasskeys && (
          <div className="mb-6">
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={passkeyLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold text-stone-950 transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {passkeyLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Fingerprint className="h-5 w-5" />
              )}
              Unlock with Passkey
            </button>

            <div className="relative my-5 flex items-center">
              <div className="flex-1 border-t" style={{ borderColor: 'var(--border)' }} />
              <span
                className="px-3 text-xs uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                or password / PIN
              </span>
              <div className="flex-1 border-t" style={{ borderColor: 'var(--border)' }} />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSetup && (
            <div>
              <label
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                First Name (optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Mike"
                className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
          )}

          <div>
            <label
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {isSetup ? 'Choose a Password or PIN' : 'Password or PIN'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSetup ? 'At least 4 characters' : 'Enter password or PIN'}
              autoFocus={!status?.hasPasskeys}
              required
              className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>

          {isSetup && (
            <div>
              <label
                className="mb-1.5 block text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                Confirm Password or PIN
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password or PIN"
                required
                className="w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
          )}

          {error && (
            <div className="text-xs font-medium" style={{ color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50"
            style={{
              backgroundColor:
                !isSetup && status?.hasPasskeys ? 'var(--bg-subtle)' : 'var(--accent)',
              color:
                !isSetup && status?.hasPasskeys ? 'var(--text)' : '#141517',
            }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSetup ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {isSetup ? 'Create Private Journal' : 'Unlock'}
          </button>
        </form>

        {isSetup && (
          <p
            className="mt-5 text-center text-xs leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            You can add a phone Passkey (Face ID / Touch ID / Fingerprint) in Settings right
            after signing in.
          </p>
        )}
      </div>
    </div>
  );
}
