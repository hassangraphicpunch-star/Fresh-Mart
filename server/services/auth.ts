import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';

const FALLBACK_DEV_SECRET = crypto
  .createHash('sha256')
  .update(`freshmart-karachi-dev-session-${process.cwd()}`)
  .digest('hex');

function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.length >= 16
    ? process.env.ADMIN_SESSION_SECRET
    : FALLBACK_DEV_SECRET;
}

export const ADMIN_COOKIE_NAME = 'fm_admin_session';
export const CUSTOMER_COOKIE_NAME = 'fm_customer_session';

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin' | 'customer';
  exp: number;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlSeconds = 60 * 60 * 24 * 7): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

export function setSessionCookie(res: Response, name: string, token: string, maxAgeSeconds = 60 * 60 * 24 * 7): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(name, token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: maxAgeSeconds * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response, name: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(name, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    path: '/',
  });
}

export interface AuthenticatedRequest extends Request {
  adminSession?: SessionPayload;
  customerSession?: SessionPayload;
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[ADMIN_COOKIE_NAME];
  const session = verifySessionToken(token);
  if (!session || (session.role !== 'admin' && session.role !== 'super_admin')) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }
  req.adminSession = session;
  next();
}

export function attachCustomerSession(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[CUSTOMER_COOKIE_NAME];
  const session = verifySessionToken(token);
  if (session && session.role === 'customer') {
    req.customerSession = session;
  }
  next();
}

export function normalizePakistanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('92') && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith('03') && digits.length === 11) {
    return digits;
  }
  if (digits.startsWith('3') && digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
}

export function isValidPakistanMobile(raw: string): boolean {
  const normalized = normalizePakistanPhone(raw);
  return /^03\d{9}$/.test(normalized);
}

export function toWhatsAppE164(raw: string): string {
  const normalized = normalizePakistanPhone(raw);
  if (normalized.startsWith('03') && normalized.length === 11) {
    return `92${normalized.slice(1)}`;
  }
  return raw.replace(/\D/g, '');
}
