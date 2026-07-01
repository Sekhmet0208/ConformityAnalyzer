import { NextResponse } from 'next/server';
import {
  ANON_COOKIE,
  claimAnonScans,
  createSession,
  createUser,
  getUserByEmail,
} from '@/lib/auth';
import { setSessionCookie } from '@/lib/session-cookies';
import { validateEmail, validatePassword } from '@/lib/validate';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

/**
 * POST /api/auth/signup { email, password }
 * Cree un compte, ouvre une session et rattache les scans anonymes du
 * navigateur (anon_id) au nouvel utilisateur.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const { email: rawEmail, password: rawPassword } = (body ?? {}) as {
    email?: string;
    password?: string;
  };

  const email = validateEmail(rawEmail);
  const password = validatePassword(rawPassword);
  if (!email) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json(
      { error: 'Mot de passe trop court (8 caracteres minimum).' },
      { status: 400 },
    );
  }
  if (await getUserByEmail(email)) {
    return NextResponse.json(
      { error: 'Un compte existe deja avec cet email.' },
      { status: 409 },
    );
  }

  const user = await createUser(email, password);
  const anonId = (await cookies()).get(ANON_COOKIE)?.value ?? null;
  await claimAnonScans(user.id, anonId);

  const { token, expires } = await createSession(user.id);
  const res = NextResponse.json({
    user: { id: user.id, email: user.email, plan: user.plan },
  });
  setSessionCookie(res, token, expires);
  return res;
}
