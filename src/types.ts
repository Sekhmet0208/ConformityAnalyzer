/**
 * Types normalises du coeur de scan.
 *
 * Le format d'un `Finding` suit la specification du PRD (section 5.2). Deux
 * champs optionnels ont ete ajoutes par rapport au format minimal :
 *  - `status` : permet de distinguer un constat sur ("confirme") d'un constat
 *    heuristique a verifier manuellement ("a_verifier"), conformement au point
 *    d'attention "precision des detections" (PRD section 8).
 *  - `id` : identifiant stable du type de regle, utile pour le dedoublonnage et
 *    les tests. Non present dans le payload public si non desire.
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
  /** URL de la page concernee. */
  url?: string;
  /** Selecteur CSS ou ancre vers l'element fautif, si applicable. */
  selector?: string;
  /** Detail libre (extrait HTML, domaine du tracker, message axe...). */
  detail?: string;
  [key: string]: unknown;
}

export interface Finding {
  /** Identifiant stable de la regle ayant produit le constat. */
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  evidence: FindingEvidence;
  recommendation: string;
  /** Reference WCAG (ex: "1.1.1") quand le constat est lie a l'accessibilite. */
  wcag_ref?: string;
  /** "confirme" (constat sur) ou "a_verifier" (heuristique). */
  status: FindingStatus;
  /** Verrouille en freemium : le detail est masque cote produit. */
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
  /** Score de conformite 0-100 (100 = aucun probleme detecte). */
  score: number;
  /** Note synthetique A-E derivee du score. */
  grade: string;
  summary: ScanSummary;
  stack: DetectedStack;
  findings: Finding[];
  /** Avertissement legal systematique (PRD sections 2.2 et 8). */
  disclaimer: string;
}
