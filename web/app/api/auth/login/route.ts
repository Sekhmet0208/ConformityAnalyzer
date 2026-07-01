import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ANON_COOKIE,
  claimAnonScans,
  createSession,
  getUserByEmail,
  verifyPassword,
} from '@/lib/auth';
import { setSessionCookie } from '@/lib/session-cookies';
import { validateEmail } from '@/lib/validate';

export const runtime = 'nodejs';

/**
 * POST /api/auth/login { email, password }
 * Verifie les identifiants, ouvre une session et rattache les scans anonymes.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const { email: rawEmail, password } = (body ?? {}) as {
    email?: string;
    password?: string;
  };
  const email = validateEmail(rawEmail);

  // Message volontairement generique (ne pas reveler si l'email existe).
  const invalid = NextResponse.json(
    { error: 'Email ou mot de passe incorrect.' },
    { status: 401 },
  );

  if (!email || typeof password !== 'string') return invalid;
  const user = await getUserByEmail(email);
  if (!user) return invalid;
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return invalid;

  const anonId = (await cookies()).get(ANON_COOKIE)?.value ?? null;
  await claimAnonScans(user.id, anonId);

  const { token, expires } = await createSession(user.id);
  const res = NextResponse.json({
    user: { id: user.id, email: user.email, plan: user.plan },
  });
  setSessionCookie(res, token, expires);
  return res;
}
