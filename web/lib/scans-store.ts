import 'server-only';
import { randomUUID } from 'node:crypto';
import { query, type ScanRow } from './db';
import type { ScanResult } from './contract';

/** CRUD des scans persistes (Lot 3). Le resultat est stocke non caviarde. */

export interface CreateScanInput {
  userId: string | null;
  anonId: string | null;
  jobId: string;
  rootUrl: string;
  tier: 'free' | 'paid';
  devUnlocked: boolean;
}

export async function createScanRow(input: CreateScanInput): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO scans
       (id, user_id, anon_id, job_id, root_url, tier, dev_unlocked, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
    [
      id,
      input.userId,
      input.anonId,
      input.jobId,
      input.rootUrl,
      input.tier,
      input.devUnlocked ? 1 : 0,
      new Date().toISOString(),
    ],
  );
  return id;
}

export async function getScanRow(id: string): Promise<ScanRow | undefined> {
  const res = await query<ScanRow>('SELECT * FROM scans WHERE id = $1', [id]);
  return res.rows[0];
}

/** Persiste un resultat de scan termine (idempotent). */
export async function persistScanResult(
  id: string,
  result: ScanResult,
): Promise<void> {
  await query(
    `UPDATE scans
       SET status = 'done', score = $1, result_json = $2, finished_at = $3
     WHERE id = $4`,
    [result.score, JSON.stringify(result), new Date().toISOString(), id],
  );
}

export async function markScanStatus(
  id: string,
  status: ScanRow['status'],
): Promise<void> {
  await query('UPDATE scans SET status = $1 WHERE id = $2', [status, id]);
}

export async function listScansForUser(userId: string): Promise<ScanRow[]> {
  const res = await query<ScanRow>(
    'SELECT * FROM scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [userId],
  );
  return res.rows;
}
