import 'server-only';
import { Queue, type RedisOptions } from 'bullmq';
import type { PublicJobStatus, ScanResult, Tier } from './contract';

/**
 * Client de file cote API Next.js. Producteur uniquement : il enfile les scans
 * et lit leur etat/resultat. Le traitement reel est fait par le worker
 * (process separe). Communication 100 % via Redis (meme nom de file).
 *
 * `import 'server-only'` garantit que ce module ne fuit jamais cote client.
 */

export const SCAN_QUEUE_NAME = 'scans';

export interface ScanJobData {
  url: string;
  tier: Tier;
  maxDepth?: number;
  maxPages?: number;
  timeoutMs?: number;
  respectRobots?: boolean;
}

function redisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
}

/**
 * On passe des OPTIONS de connexion (et non une instance ioredis) : BullMQ cree
 * ainsi sa propre connexion avec sa version d'ioredis, ce qui evite tout
 * conflit de types entre l'ioredis du worker et celui embarque par BullMQ.
 */
function connectionOptions(): RedisOptions {
  const u = new URL(redisUrl());
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    username: u.username || undefined,
    password: u.password || undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
    maxRetriesPerRequest: null,
  };
}

// Singleton par process (Next.js peut recharger : on memoise sur globalThis).
const globalForQueue = globalThis as unknown as {
  __scanQueue?: Queue<ScanJobData, ScanResult>;
};

export function scanQueue(): Queue<ScanJobData, ScanResult> {
  if (!globalForQueue.__scanQueue) {
    globalForQueue.__scanQueue = new Queue<ScanJobData, ScanResult>(
      SCAN_QUEUE_NAME,
      { connection: connectionOptions() },
    ) as Queue<ScanJobData, ScanResult>;
  }
  return globalForQueue.__scanQueue;
}

export async function enqueueScan(data: ScanJobData): Promise<string> {
  const job = await scanQueue().add('scan', data, {
    attempts: 1,
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 3600, count: 1000 },
  });
  return String(job.id);
}

export function toPublicStatus(state: string): PublicJobStatus {
  switch (state) {
    case 'completed':
      return 'done';
    case 'failed':
      return 'failed';
    case 'active':
      return 'running';
    case 'unknown':
      return 'not_found';
    default:
      return 'pending';
  }
}

export interface JobSnapshot {
  status: PublicJobStatus;
  progress: number;
  result: ScanResult | null;
  error: string | null;
}

/** Etat brut d'un job BullMQ (sans logique de droits). null si introuvable. */
export async function getJobSnapshot(jobId: string): Promise<JobSnapshot | null> {
  const job = await scanQueue().getJob(jobId);
  if (!job) return null;
  const state = await job.getState();
  const status = toPublicStatus(state);
  const progress =
    typeof job.progress === 'number' ? job.progress : status === 'done' ? 100 : 0;
  return {
    status,
    progress,
    result: status === 'done' ? ((job.returnvalue as ScanResult) ?? null) : null,
    error: status === 'failed' ? (job.failedReason ?? 'Scan en echec') : null,
  };
}
