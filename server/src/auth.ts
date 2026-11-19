import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getSetting, setSetting } from './db.js';

const SESSION_COOKIE = 'midline_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  let secret = getSetting('session_secret');
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    setSetting('session_secret', secret);
  }
  return secret;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function isSetupComplete(): boolean {
  return Boolean(getSetting('password_hash'));
}

function signToken(payload: string): string {
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { exp: number } | null {
  const idx = token.lastIndexOf('.');
  if (idx === -1) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp: number };
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSessionCookie(req: Request, res: Response): void {
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'owner',
      iat: Date.now(),
      exp: Date.now() + SESSION_MAX_AGE_MS,
    })
  ).toString('base64url');
  const token = signToken(payload);
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  const lockOnClose = getSetting('lock_on_close') === '1';

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    ...(lockOnClose ? {} : { maxAge: SESSION_MAX_AGE_MS }),
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function isAuthenticated(req: Request): boolean {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || typeof token !== 'string') return false;
  return verifyToken(token) !== null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isSetupComplete()) {
    res.status(401).json({ error: 'Setup required', code: 'SETUP_REQUIRED' });
    return;
  }
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    return;
  }
  next();
}

export function getWebAuthnConfig(req: Request): {
  rpID: string;
  origin: string;
  rpName: string;
} {
  const rpName = process.env.RP_NAME || 'Midline Journal';

  const headerOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const proto =
    (typeof req.headers['x-forwarded-proto'] === 'string'
      ? req.headers['x-forwarded-proto'].split(',')[0].trim()
      : req.protocol) || 'http';
  const host =
    (typeof req.headers['x-forwarded-host'] === 'string'
      ? req.headers['x-forwarded-host'].split(',')[0].trim()
      : req.headers.host) || 'localhost:3001';

  const origin = process.env.ORIGIN || headerOrigin || `${proto}://${host}`;

  let rpID = process.env.RP_ID || '';
  if (!rpID) {
    try {
      rpID = new URL(origin).hostname;
    } catch {
      rpID = req.hostname || 'localhost';
    }
  }

  return { rpID, origin, rpName };
}
