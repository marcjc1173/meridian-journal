import { Router } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { db, getSetting, setSetting } from '../db.js';
import {
  clearSessionCookie,
  getWebAuthnConfig,
  hashPassword,
  isAuthenticated,
  isSetupComplete,
  requireAuth,
  setSessionCookie,
  verifyPassword,
} from '../auth.js';

const router = Router();

interface PasskeyRow {
  id: string;
  name: string;
  public_key: string;
  counter: number;
  transports: string | null;
  device_type: string | null;
  backed_up: number;
  created_at: string;
  last_used_at: string | null;
}

// In-memory WebAuthn challenge store (single-user, 5-minute TTL)
let pendingRegChallenge: { challenge: string; expiresAt: number } | null = null;
let pendingAuthChallenge: { challenge: string; expiresAt: number } | null = null;

const OWNER_USER_ID = new TextEncoder().encode('midline-journal-owner');

// GET /api/auth/status
router.get('/status', (req, res) => {
  const setupComplete = isSetupComplete();
  const authenticated = setupComplete && isAuthenticated(req);
  const passkeyCount = (
    db.prepare('SELECT COUNT(*) as count FROM passkeys').get() as { count: number }
  ).count;
  const displayName = getSetting('display_name') || '';
  const autoLockMinutes = Number(getSetting('auto_lock_minutes') || '0') || 0;
  const lockOnClose = getSetting('lock_on_close') === '1';

  res.json({
    setupComplete,
    authenticated,
    hasPasskeys: passkeyCount > 0,
    passkeyCount,
    displayName: authenticated ? displayName : '',
    autoLockMinutes: authenticated ? autoLockMinutes : 0,
    lockOnClose: authenticated ? lockOnClose : false,
  });
});

// POST /api/auth/setup (first run)
router.post('/setup', (req, res) => {
  if (isSetupComplete()) {
    res.status(400).json({ error: 'Journal is already set up.' });
    return;
  }
  const { password, displayName } = req.body as { password?: string; displayName?: string };
  if (!password || typeof password !== 'string' || password.length < 4) {
    res.status(400).json({ error: 'Please choose a password or PIN of at least 4 characters.' });
    return;
  }

  setSetting('password_hash', hashPassword(password));
  if (displayName && typeof displayName === 'string') {
    setSetting('display_name', displayName.trim().slice(0, 60));
  }

  setSessionCookie(req, res);
  res.json({ ok: true });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  if (!isSetupComplete()) {
    res.status(400).json({ error: 'Journal has not been set up yet.' });
    return;
  }
  const { password } = req.body as { password?: string };
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Password or PIN is required.' });
    return;
  }

  const stored = getSetting('password_hash');
  if (!stored || !verifyPassword(password, stored)) {
    res.status(401).json({ error: 'Incorrect password or PIN.' });
    return;
  }

  setSessionCookie(req, res);
  res.json({ ok: true });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword || newPassword.length < 4) {
    res.status(400).json({ error: 'New password or PIN must be at least 4 characters.' });
    return;
  }
  const stored = getSetting('password_hash');
  if (!stored || !verifyPassword(currentPassword, stored)) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }
  setSetting('password_hash', hashPassword(newPassword));
  res.json({ ok: true });
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, (req, res) => {
  const { displayName } = req.body as { displayName?: string };
  setSetting('display_name', (displayName || '').trim().slice(0, 60));
  res.json({ ok: true, displayName: getSetting('display_name') || '' });
});

// PUT /api/auth/auto-lock
router.put('/auto-lock', requireAuth, (req, res) => {
  const { autoLockMinutes, lockOnClose } = req.body as {
    autoLockMinutes?: number;
    lockOnClose?: boolean;
  };
  const allowed = [0, 1, 5, 15, 30, 60];
  if (typeof autoLockMinutes === 'number' && allowed.includes(autoLockMinutes)) {
    setSetting('auto_lock_minutes', String(autoLockMinutes));
  }
  if (typeof lockOnClose === 'boolean') {
    setSetting('lock_on_close', lockOnClose ? '1' : '0');
  }
  // Re-issue cookie so session vs persistent maxAge takes effect immediately
  setSessionCookie(req, res);
  res.json({
    ok: true,
    autoLockMinutes: Number(getSetting('auto_lock_minutes') || '0') || 0,
    lockOnClose: getSetting('lock_on_close') === '1',
  });
});

// ---------------- Passkey (WebAuthn) ----------------

// GET /api/auth/passkeys
router.get('/passkeys', requireAuth, (_req, res) => {
  const rows = db
    .prepare(
      'SELECT id, name, device_type, backed_up, created_at, last_used_at FROM passkeys ORDER BY created_at DESC'
    )
    .all();
  res.json({ passkeys: rows });
});

// DELETE /api/auth/passkeys/:id
router.delete('/passkeys/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM passkeys WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/auth/passkey/register/options
router.post('/passkey/register/options', requireAuth, async (req, res) => {
  try {
    const { rpID, rpName } = getWebAuthnConfig(req);
    const existing = db.prepare('SELECT id, transports FROM passkeys').all() as {
      id: string;
      transports: string | null;
    }[];

    const displayName = getSetting('display_name') || 'Journal Owner';

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: OWNER_USER_ID,
      userName: displayName,
      attestationType: 'none',
      excludeCredentials: existing.map((row) => ({
        id: row.id,
        transports: row.transports
          ? (JSON.parse(row.transports) as AuthenticatorTransportFuture[])
          : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    pendingRegChallenge = {
      challenge: options.challenge,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    res.json(options);
  } catch (err) {
    console.error('Passkey register options error:', err);
    res.status(500).json({ error: 'Could not start passkey registration.' });
  }
});

// POST /api/auth/passkey/register/verify
router.post('/passkey/register/verify', requireAuth, async (req, res) => {
  try {
    if (!pendingRegChallenge || pendingRegChallenge.expiresAt < Date.now()) {
      res.status(400).json({ error: 'Registration challenge expired. Please try again.' });
      return;
    }

    const { response, name } = req.body as { response: unknown; name?: string };
    const { rpID, origin } = getWebAuthnConfig(req);

    const verification = await verifyRegistrationResponse({
      response: response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
      expectedChallenge: pendingRegChallenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    pendingRegChallenge = null;

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'Passkey verification failed.' });
      return;
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const publicKeyBase64 = Buffer.from(credential.publicKey).toString('base64');
    const transports = credential.transports ? JSON.stringify(credential.transports) : null;
    const label = (name || 'My Device').trim().slice(0, 50) || 'My Device';

    db.prepare(
      `INSERT INTO passkeys (id, name, public_key, counter, transports, device_type, backed_up)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      credential.id,
      label,
      publicKeyBase64,
      credential.counter,
      transports,
      credentialDeviceType,
      credentialBackedUp ? 1 : 0
    );

    res.json({ ok: true, id: credential.id, name: label });
  } catch (err) {
    console.error('Passkey register verify error:', err);
    res.status(400).json({
      error:
        err instanceof Error
          ? err.message
          : 'Could not verify passkey. Make sure you are using HTTPS or localhost.',
    });
  }
});

// POST /api/auth/passkey/login/options
router.post('/passkey/login/options', async (req, res) => {
  try {
    const passkeys = db.prepare('SELECT id, transports FROM passkeys').all() as {
      id: string;
      transports: string | null;
    }[];

    if (passkeys.length === 0) {
      res.status(400).json({ error: 'No passkeys registered yet.' });
      return;
    }

    const { rpID } = getWebAuthnConfig(req);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map((row) => ({
        id: row.id,
        transports: row.transports
          ? (JSON.parse(row.transports) as AuthenticatorTransportFuture[])
          : undefined,
      })),
      userVerification: 'preferred',
    });

    pendingAuthChallenge = {
      challenge: options.challenge,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    res.json(options);
  } catch (err) {
    console.error('Passkey login options error:', err);
    res.status(500).json({ error: 'Could not start passkey sign-in.' });
  }
});

// POST /api/auth/passkey/login/verify
router.post('/passkey/login/verify', async (req, res) => {
  try {
    if (!pendingAuthChallenge || pendingAuthChallenge.expiresAt < Date.now()) {
      res.status(400).json({ error: 'Sign-in challenge expired. Please try again.' });
      return;
    }

    const body = req.body as { id?: string };
    const passkey = db
      .prepare('SELECT * FROM passkeys WHERE id = ?')
      .get(body.id) as PasskeyRow | undefined;

    if (!passkey) {
      res.status(401).json({ error: 'Unrecognized passkey.' });
      return;
    }

    const { rpID, origin } = getWebAuthnConfig(req);

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: pendingAuthChallenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(Buffer.from(passkey.public_key, 'base64')),
        counter: passkey.counter,
        transports: passkey.transports
          ? (JSON.parse(passkey.transports) as AuthenticatorTransportFuture[])
          : undefined,
      },
      requireUserVerification: false,
    });

    pendingAuthChallenge = null;

    if (!verification.verified) {
      res.status(401).json({ error: 'Passkey authentication failed.' });
      return;
    }

    db.prepare(
      "UPDATE passkeys SET counter = ?, last_used_at = datetime('now') WHERE id = ?"
    ).run(verification.authenticationInfo.newCounter, passkey.id);

    setSessionCookie(req, res);
    res.json({ ok: true });
  } catch (err) {
    console.error('Passkey login verify error:', err);
    res.status(401).json({ error: 'Passkey authentication failed.' });
  }
});

export default router;
