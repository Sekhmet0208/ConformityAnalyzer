import { Queue, type RedisOptions } from 'bullmq';
import type { ScanResult, Tier } from '../types.js';

/**
 * Couche file de jobs (PRD section 4 : "Workers de scan : processus separes
 * consommant une file de jobs (Redis/RabbitMQ)"). Producteur (API Next.js) et
 * consommateur (worker) communiquent uniquement via Redis -> total decouplage.
 */

export const SCAN_QUEUE_NAME = 'scans';

/** Donnees d'un job de scan envoyees par l'API. */
export interface ScanJobData {
  url: string;
  tier: Tier;
  maxDepth?: number;
  maxPages?: number;
  timeoutMs?: number;
  respectRobots?: boolean;
}

/** Resultat stocke par le worker (rapport normalise, deja redacte selon tier). */
export type ScanJobResult = ScanResult;

export function redisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
}

/**
 * Options de connexion Redis pour BullMQ. On passe des OPTIONS (et non une
 * instance ioredis) pour que BullMQ utilise sa propre version d'ioredis et
 * eviter tout conflit de types entre ioredis racine et celui embarque par
 * BullMQ. `maxRetriesPerRequest: null` est requis par les workers BullMQ.
 */
export function connectionOptions(): RedisOptions {
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

const globalForQueue = globalThis as unknown as {
  __scanQueue?: Queue<ScanJobData, ScanJobResult>;
};

/** File de scans (cote producteur). Reutilise une instance unique par process. */
export function getScanQueue(): Queue<ScanJobData, ScanJobResult> {
  if (!globalForQueue.__scanQueue) {
    globalForQueue.__scanQueue = new Queue<ScanJobData, ScanJobResult>(
      SCAN_QUEUE_NAME,
      {
        connection: connectionOptions(),
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 3600, count: 1000 },
        },
      },
    ) as Queue<ScanJobData, ScanJobResult>;
  }
  return globalForQueue.__scanQueue;
}

/** Statut public d'un job, expose au frontend. */
export type PublicJobStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'not_found';

export interface JobStatusResponse {
  id: string;
  status: PublicJobStatus;
  /** Progression 0-100 si disponible. */
  progress: number;
  result: ScanJobResult | null;
  error: string | null;
}

/** Traduit l'etat BullMQ en statut public simplifie. */
export function toPublicStatus(state: string): PublicJobStatus {
  switch (state) {
    case 'completed':
      return 'done';
    case 'failed':
      return 'failed';
    case 'active':
      return 'running';
    case 'waiting':
    case 'waiting-children':
    case 'delayed':
    case 'prioritized':
      return 'pending';
    case 'unknown':
      return 'not_found';
    default:
      return 'pending';
  }
}
