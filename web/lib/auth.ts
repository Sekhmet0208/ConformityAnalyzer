import 'server-only';
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { query, type Plan, type UserRow } from './db';

const scrypt = promisify(scryptCb);

export const SESSION_COOKIE = 'cs_session';
export const ANON_COOKIE = 'cs_anon';
const SESSION_TTL_DAYS = 30;

// --- Mots de passe (scrypt, crypto natif, sans dependance) -----------------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1]!, 'hex');
  const expected = Buffer.from(parts[2]!, 'hex');
  const derived = (await scrypt(password, salt, expected.length)) as Buffer;
  // Comparaison a temps constant pour eviter les attaques temporelles.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

// --- Utilisateurs ----------------------------------------------------------

export async function getUserByEmail(email: string): Promise<UserRow | undefined> {
  const res = await query<UserRow>('SELECT * FROM users WHERE email = $1', [
    email.toLowerCase(),
  ]);
  return res.rows[0];
}

export async function getUserById(id: string): Promise<UserRow | undefined> {
  const res = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return res.rows[0];
}

export async function createUser(
  email: string,
  password: string,
): Promise<UserRow> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  await query(
    `INSERT INTO users (id, email, password_hash, plan, created_at)
     VALUES ($1, $2, $3, 'free', $4)`,
    [id, email.toLowerCase(), passwordHash, now],
  );
  return (await getUserById(id))!;
}

export async function setUserPlan(userId: string, plan: Plan): Promise<void> {
  await query('UPDATE users SET plan = $1 WHERE id = $2', [plan, userId]);
}

// --- Sessions --------------------------------------------------------------

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Cree une session et renvoie le token brut a poser en cookie httpOnly. */
export async function createSession(
  userId: string,
): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      randomUUID(),
      userId,
      hashToken(token),
      expires.toISOString(),
      new Date().toISOString(),
    ],
  );
  return { token, expires };
}

export async function getUserBySessionToken(
  token: string,
): Promise<UserRow | undefined> {
  const res = await query<{ user_id: string; expires_at: string }>(
    'SELECT user_id, expires_at FROM sessions WHERE token_hash = $1',
    [hashToken(token)],
  );
  const row = res.rows[0];
  if (!row) return undefined;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
    return undefined;
  }
  return getUserById(row.user_id);
}

export async function deleteSession(token: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

// --- Lecture du contexte courant (cookies) ---------------------------------

/** Utilisateur courant a partir du cookie de session (server-only). */
export async function getCurrentUser(): Promise<UserRow | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return (await getUserBySessionToken(token)) ?? null;
}

/** Identifiant anonyme courant (cookie), ou null s'il n'existe pas encore. */
export async function getAnonId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ANON_COOKIE)?.value ?? null;
}

// --- Rattachement des scans anonymes (claiming) ----------------------------

/**
 * Rattache a un utilisateur tous les scans anonymes crees depuis ce navigateur
 * (meme anon_id) et non encore rattaches. Appele a l'inscription/connexion.
 */
export async function claimAnonScans(
  userId: string,
  anonId: string | null,
): Promise<number> {
  if (!anonId) return 0;
  const res = await query(
    `UPDATE scans SET user_id = $1
     WHERE anon_id = $2 AND user_id IS NULL`,
    [userId, anonId],
  );
  return res.rowCount ?? 0;
}
