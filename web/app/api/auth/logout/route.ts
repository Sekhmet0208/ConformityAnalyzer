import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, deleteSession } from '@/lib/auth';
import { clearSessionCookie } from '@/lib/session-cookies';

export const runtime = 'nodejs';

/** POST /api/auth/logout — detruit la session courante et efface le cookie. */
export async function POST(): Promise<NextResponse> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
