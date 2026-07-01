import 'server-only';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

/**
 * Couche d'acces a la base relationnelle (Lot 3 — comptes & paiement).
 *
 * PostgreSQL (Neon en production, ou tout Postgres local en dev) pilote par
 * DATABASE_URL. On garde du SQL standard et un acces centralise ici. Le schema
 * est cree au premier acces (migration idempotente via CREATE TABLE IF NOT
 * EXISTS), ce qui evite un outil de migration externe pour ce MVP.
 *
 * Historique : cette couche utilisait SQLite (better-sqlite3, synchrone). Elle
 * est passee a pg (asynchrone) pour le deploiement Postgres/Neon. Toutes les
 * fonctions d'acces aux donnees sont donc desormais `async`.
 *
 * Schema (PRD §5.1, adapte) :
 *   users(id, email, password_hash, plan, created_at)
 *   sessions(id, user_id, token_hash, expires_at, created_at)
 *   scans(id, user_id?, anon_id?, job_id, root_url, tier, dev_unlocked,
 *         status, score, result_json, created_at, finished_at)
 *   subscriptions(id, user_id, stripe_customer_id, stripe_subscription_id,
 *                 plan, status, current_period_end, created_at, updated_at)
 *   documents(id, user_id, scan_id?, type, title, status, context_json, html,
 *             generator, created_at)
 *
 * Note dev : le resultat complet du scan est stocke dans `scans.result_json`
 * (non caviarde). Le caviardage est applique a la LECTURE selon les droits
 * (cf. lib/entitlement.ts), ce qui permet de "debloquer le detail" du meme scan
 * apres paiement (PRD §6).
 */

export type Plan = 'free' | 'paid';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  plan: Plan;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface ScanRow {
  id: string;
  user_id: string | null;
  anon_id: string | null;
  job_id: string | null;
  root_url: string;
  tier: 'free' | 'paid';
  dev_unlocked: number; // 0 | 1 (conserve pour compat entitlement.ts)
  status: 'pending' | 'running' | 'done' | 'failed';
  score: number | null;
  result_json: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  user_id: string;
  scan_id: string | null;
  type: string;
  title: string;
  status: string;
  context_json: string;
  html: string;
  generator: string;
  created_at: string;
}

const globalForDb = globalThis as unknown as {
  __appPool?: Pool;
  __appMigrated?: Promise<void>;
};

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL manquant. Definir une URL de connexion Postgres ' +
        '(ex. Neon : postgres://user:pass@host/db?sslmode=require).',
    );
  }
  return url;
}

/** Pool de connexions unique par process (reutilise entre requetes). */
function pool(): Pool {
  if (!globalForDb.__appPool) {
    globalForDb.__appPool = new Pool({
      connectionString: databaseUrl(),
      // Neon exige TLS ; on l'active tant qu'on ne cible pas explicitement un
      // Postgres local sans SSL (DATABASE_SSL=disable).
      ssl:
        process.env.DATABASE_SSL === 'disable'
          ? false
          : { rejectUnauthorized: false },
      max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '10', 10),
    });
  }
  return globalForDb.__appPool;
}

/**
 * Execute une requete parametree. Lance la migration (une seule fois par
 * process) avant la premiere requete effective.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  await ensureMigrated();
  return pool().query<T>(text, params as unknown[]);
}

/** Migration idempotente memoisee : ne s'execute qu'une fois par process. */
function ensureMigrated(): Promise<void> {
  if (!globalForDb.__appMigrated) {
    globalForDb.__appMigrated = migrate().catch((err) => {
      // En cas d'echec, on ne memoise pas l'echec : le prochain appel reessaie.
      globalForDb.__appMigrated = undefined;
      throw err;
    });
  }
  return globalForDb.__appMigrated;
}

async function migrate(): Promise<void> {
  await pool().query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      anon_id TEXT,
      job_id TEXT,
      root_url TEXT NOT NULL,
      tier TEXT NOT NULL,
      dev_unlocked INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      score INTEGER,
      result_json TEXT,
      created_at TEXT NOT NULL,
      finished_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);
    CREATE INDEX IF NOT EXISTS idx_scans_anon ON scans(anon_id);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      plan TEXT NOT NULL,
      status TEXT NOT NULL,
      current_period_end TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subs_customer ON subscriptions(stripe_customer_id);

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scan_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready',
      context_json TEXT NOT NULL,
      html TEXT NOT NULL,
      generator TEXT NOT NULL DEFAULT 'template',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_docs_user ON documents(user_id);
  `);
}
