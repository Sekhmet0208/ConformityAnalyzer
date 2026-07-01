import 'server-only';
import { randomUUID } from 'node:crypto';
import type { NextResponse } from 'next/server';
import { ANON_COOKIE, SESSION_COOKIE } from './auth';

/**
 * Helpers de pose/retrait des cookies d'authentification sur une NextResponse.
 * httpOnly + sameSite=lax (mitige le CSRF pour les POST top-level) + secure en
 * production.
 */

const isProd = process.env.NODE_ENV === 'production';

export function setSessionCookie(
  res: NextResponse,
  token: string,
  expires: Date,
): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    expires,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 0,
  });
}

/**
 * Garantit la presence d'un identifiant anonyme : renvoie l'existant ou en cree
 * un nouveau (et le pose en cookie). Sert au rattachement des scans anonymes.
 */
export function ensureAnonCookie(
  res: NextResponse,
  existing: string | null,
): string {
  if (existing) return existing;
  const anonId = randomUUID();
  res.cookies.set(ANON_COOKIE, anonId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 365 * 86_400,
  });
  return anonId;
}
