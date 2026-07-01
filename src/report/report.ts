import type {
  Finding,
  ScanMeta,
  ScanResult,
  Tier,
} from '../types.js';
import type { CrawlResult } from '../crawler/types.js';
import { LEGAL_DISCLAIMER } from '../constants.js';
import {
  computeScore,
  gradeFromScore,
  prioritize,
  summarize,
} from './score.js';

export interface BuildReportInput {
  crawl: CrawlResult;
  findings: Finding[];
  tier: Tier;
  startedAt: number;
  finishedAt: number;
}

/**
 * Assemble le rapport final normalise. Le score est calcule sur l'integralite
 * des findings (le freemium connait son score) ; en revanche, le DETAIL des
 * findings est verrouille (`locked`) pour le palier gratuit (PRD 1.3 : le scan
 * gratuit "revele les problemes" mais paywall les corrections/details).
 */
export function buildReport(input: BuildReportInput): ScanResult {
  const { crawl, tier, startedAt, finishedAt } = input;

  // Verrouillage selon le palier : tout est deverrouille en payant.
  const findings = applyLocking(input.findings, tier);
  const ordered = prioritize(findings);

  const score = computeScore(ordered);
  const summary = summarize(ordered);

  const meta: ScanMeta = {
    root_url: crawl.rootUrl,
    bot: 'ComplianceBot/1.0',
    tier,
    started_at: new Date(startedAt).toISOString(),
    finished_at: new Date(finishedAt).toISOString(),
    duration_ms: finishedAt - startedAt,
    pages_crawled: crawl.pages.filter((p) => !p.error).length,
    pages_discovered: crawl.pagesDiscovered,
    robots_respected: crawl.robotsRespected,
  };

  return {
    scan: meta,
    score,
    grade: gradeFromScore(score),
    summary,
    stack: crawl.stack,
    findings: ordered,
    disclaimer: LEGAL_DISCLAIMER,
  };
}

/**
 * En freemium, `locked = true` : le produit affichera titre/categorie/severite
 * mais masquera evidence/recommendation. En payant, on deverrouille tout.
 */
function applyLocking(findings: Finding[], tier: Tier): Finding[] {
  if (tier === 'paid') {
    return findings.map((f) => ({ ...f, locked: false }));
  }
  return findings.map((f) => ({ ...f, locked: true }));
}

/**
 * Vue "publique" d'un rapport freemium : masque concretement le contenu
 * verrouille, afin que la sortie JSON ne fuite pas les details payants.
 */
export function redactLocked(report: ScanResult): ScanResult {
  return {
    ...report,
    findings: report.findings.map((f) =>
      f.locked
        ? {
            ...f,
            evidence: { detail: 'Verrouille — passez a une offre payante.' },
            recommendation: 'Verrouille — passez a une offre payante.',
          }
        : f,
    ),
  };
}
