import { Worker, type Job } from 'bullmq';
import { runScan } from '../scan.js';
import {
  SCAN_QUEUE_NAME,
  connectionOptions,
  type ScanJobData,
  type ScanJobResult,
} from './queue.js';

/**
 * Worker de scan (process separe). Consomme la file `scans`, pilote un
 * navigateur headless via le coeur de scan (Lot 1) et renvoie le rapport
 * normalise COMPLET (non caviarde).
 *
 * Lot 3 : le caviardage (paywall) n'est PLUS fait ici. Le rapport complet est
 * stocke, et le masquage des details est applique a la LECTURE selon les droits
 * du visiteur (cf. web/lib/entitlement.ts). Cela permet de "debloquer le detail"
 * du meme scan apres paiement (PRD §6). Le palier `tier` ne controle plus que la
 * portee du crawl (nombre de pages).
 *
 * Lancement : `npm run worker` (tsx src/server/worker.ts).
 */

const concurrency = Number.parseInt(process.env.SCAN_CONCURRENCY ?? '2', 10);

const worker = new Worker<ScanJobData, ScanJobResult>(
  SCAN_QUEUE_NAME,
  async (job: Job<ScanJobData>) => {
    const { url, tier, maxDepth, maxPages, timeoutMs, respectRobots } =
      job.data;

    await job.updateProgress(10);

    // On construit le rapport avec evidences completes (tier 'paid' au sens du
    // build) mais en conservant la PORTEE de crawl du palier demande.
    const report = await runScan({
      url,
      tier: 'paid',
      maxDepth,
      maxPages: maxPages ?? (tier === 'paid' ? 50 : 5),
      timeoutMs,
      respectRobots,
    });
    // On enregistre le palier reel (portee) dans la meta du rapport.
    report.scan.tier = tier;

    await job.updateProgress(100);
    return report;
  },
  {
    connection: connectionOptions(),
    concurrency: Number.isNaN(concurrency) ? 2 : concurrency,
  },
);

worker.on('completed', (job) => {
  // eslint-disable-next-line no-console
  console.log(`[worker] scan ${job.id} termine (${job.data.url})`);
});

worker.on('failed', (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`[worker] scan ${job?.id} echoue : ${err.message}`);
});

// eslint-disable-next-line no-console
console.log(
  `[worker] pret. File "${SCAN_QUEUE_NAME}", concurrence ${concurrency}.`,
);

async function shutdown(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[worker] arret en cours...');
  await worker.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
