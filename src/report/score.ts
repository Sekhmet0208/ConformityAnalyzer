import type {
  Category,
  Finding,
  ScanSummary,
  Severity,
} from '../types.js';
import {
  SEVERITY_ORDER,
  SEVERITY_WEIGHTS,
  TO_VERIFY_WEIGHT_FACTOR,
} from '../constants.js';

const SEVERITIES: Severity[] = ['critique', 'important', 'mineur'];
const CATEGORIES: Category[] = [
  'cookies',
  'rgpd',
  'mentions_legales',
  'accessibilite',
];

/**
 * Calcule un score de conformite 0-100 (100 = aucun probleme). Chaque finding
 * confirme retire `SEVERITY_WEIGHTS[severity]` points ; un finding "a_verifier"
 * pese moins (facteur `TO_VERIFY_WEIGHT_FACTOR`) pour ne pas surpenaliser sur
 * un possible faux positif (PRD 8). Score borne a [0, 100].
 */
export function computeScore(findings: Finding[]): number {
  let penalty = 0;
  for (const f of findings) {
    const base = SEVERITY_WEIGHTS[f.severity];
    penalty += f.status === 'confirme' ? base : base * TO_VERIFY_WEIGHT_FACTOR;
  }
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  return score;
}

/** Note A-E synthetique derivee du score. */
export function gradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 55) return 'C';
  if (score >= 35) return 'D';
  return 'E';
}

export function summarize(findings: Finding[]): ScanSummary {
  const bySeverity: Record<Severity, number> = {
    critique: 0,
    important: 0,
    mineur: 0,
  };
  const byCategory: Record<Category, number> = {
    cookies: 0,
    rgpd: 0,
    mentions_legales: 0,
    accessibilite: 0,
  };
  let confirmed = 0;
  let toVerify = 0;

  for (const f of findings) {
    bySeverity[f.severity]++;
    byCategory[f.category]++;
    if (f.status === 'confirme') confirmed++;
    else toVerify++;
  }

  return {
    total: findings.length,
    confirmed,
    to_verify: toVerify,
    by_severity: bySeverity,
    by_category: byCategory,
  };
}

/**
 * Trie les findings par priorite : severite decroissante, puis statut
 * (confirme avant a_verifier), puis categorie pour la stabilite.
 */
export function prioritize(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    if (a.status !== b.status) return a.status === 'confirme' ? -1 : 1;
    const ca = CATEGORIES.indexOf(a.category);
    const cb = CATEGORIES.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  });
}

export { SEVERITIES, CATEGORIES };
