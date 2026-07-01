import type { Browser } from 'playwright';
import type { Finding, ScanResult, Tier } from './types.js';
import { Crawler } from './crawler/crawler.js';
import type { CrawlResult } from './crawler/types.js';
import type { Analyzer } from './analyzers/analyzer.js';
import { RgpdCookiesAnalyzer } from './analyzers/rgpd-cookies.js';
import { AccessibilityAnalyzer } from './analyzers/accessibility.js';
import { LegalMentionsAnalyzer } from './analyzers/legal-mentions.js';
import { buildReport } from './report/report.js';

export interface ScanOptions {
  url: string;
  tier?: Tier;
  maxDepth?: number;
  maxPages?: number;
  timeoutMs?: number;
  respectRobots?: boolean;
  /** Permet d'injecter un sous-ensemble d'analyseurs (tests). */
  analyzers?: Analyzer[];
  /** Permet d'injecter un navigateur (tests / serveur de fixtures). */
  launch?: () => Promise<Browser>;
}

/** Jeu d'analyseurs par defaut (tous les modules [MVP] du Lot 1). */
export function defaultAnalyzers(): Analyzer[] {
  return [
    new RgpdCookiesAnalyzer(),
    new AccessibilityAnalyzer(),
    new LegalMentionsAnalyzer(),
  ];
}

/**
 * Orchestrateur de scan : crawl -> analyse (modules composables) -> rapport
 * normalise. C'est le point d'entree programmatique du coeur de scan (Lot 1).
 */
export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const tier: Tier = options.tier ?? 'free';
  const startedAt = Date.now();

  const crawler = new Crawler({
    rootUrl: options.url,
    tier,
    maxDepth: options.maxDepth,
    maxPages: options.maxPages,
    timeoutMs: options.timeoutMs,
    respectRobots: options.respectRobots,
    launch: options.launch,
  });

  const crawl = await crawler.crawl();
  const findings = await runAnalyzers(
    crawl,
    options.analyzers ?? defaultAnalyzers(),
  );
  const finishedAt = Date.now();

  return buildReport({ crawl, findings, tier, startedAt, finishedAt });
}

/** Execute les analyseurs et agrege leurs findings (tolerant aux erreurs). */
export async function runAnalyzers(
  crawl: CrawlResult,
  analyzers: Analyzer[],
): Promise<Finding[]> {
  const all: Finding[] = [];
  for (const analyzer of analyzers) {
    try {
      const result = await analyzer.analyze(crawl);
      all.push(...result);
    } catch (err) {
      // Un module defaillant ne doit pas faire echouer tout le scan.
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error(`[scan] analyseur "${analyzer.id}" en echec : ${message}`);
    }
  }
  return all;
}
