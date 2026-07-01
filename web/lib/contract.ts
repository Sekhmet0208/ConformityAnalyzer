/**
 * Contrat d'API partage avec le coeur de scan (format normalise §5.2 du PRD).
 *
 * Volontairement DUPLIQUE cote frontend : le web ne depend d'aucun code runtime
 * du coeur (qui embarque Playwright). Web et worker communiquent uniquement par
 * Redis ; ces types decrivent la forme du JSON echange. Garder synchronise avec
 * `src/types.ts`.
 */

export type Category =
  | 'cookies'
  | 'rgpd'
  | 'mentions_legales'
  | 'accessibilite';

export type Severity = 'critique' | 'important' | 'mineur';
export type FindingStatus = 'confirme' | 'a_verifier';
export type Tier = 'free' | 'paid';

export interface FindingEvidence {
  url?: string;
  selector?: string;
  detail?: string;
  [key: string]: unknown;
}

export interface Finding {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  evidence: FindingEvidence;
  recommendation: string;
  wcag_ref?: string;
  status: FindingStatus;
  locked: boolean;
}

export interface ScanSummary {
  total: number;
  confirmed: number;
  to_verify: number;
  by_severity: Record<Severity, number>;
  by_category: Record<Category, number>;
}

export interface DetectedStack {
  cms: string | null;
  cmp: string | null;
  trackers: string[];
}

export interface ScanMeta {
  root_url: string;
  bot: string;
  tier: Tier;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  pages_crawled: number;
  pages_discovered: number;
  robots_respected: boolean;
}

export interface ScanResult {
  scan: ScanMeta;
  score: number;
  grade: string;
  summary: ScanSummary;
  stack: DetectedStack;
  findings: Finding[];
  disclaimer: string;
}

export type PublicJobStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'not_found';

export interface JobStatusResponse {
  id: string;
  status: PublicJobStatus;
  progress: number;
  result: ScanResult | null;
  error: string | null;
  /** true si le visiteur a le droit de voir le detail (paywall). */
  unlocked: boolean;
}

// --- Libelles d'affichage --------------------------------------------------

export const CATEGORY_LABELS: Record<Category, string> = {
  cookies: 'Cookies',
  rgpd: 'RGPD',
  mentions_legales: 'Mentions legales',
  accessibilite: 'Accessibilite',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critique: 'Critique',
  important: 'Important',
  mineur: 'Mineur',
};
