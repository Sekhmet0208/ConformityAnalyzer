import type { Severity } from './types.js';

/**
 * User-agent identifiable et honnete (PRD section 3.1). Les sites peuvent ainsi
 * reconnaitre et, le cas echeant, bloquer le robot via robots.txt.
 */
export const BOT_USER_AGENT =
  'ComplianceBot/1.0 (+https://compliance-scan.example/bot)';

/**
 * Avertissement legal reutilise partout (PRD section 9 : "Ajoute le disclaimer
 * legal comme constante reutilisee partout"). L'outil ne fournit jamais de
 * conseil juridique et ne garantit pas la conformite.
 */
export const LEGAL_DISCLAIMER =
  "Cet outil fournit une aide automatisee a la mise en conformite ainsi que des " +
  "documents-types. Il ne constitue pas un conseil juridique personnalise et ne " +
  "garantit en aucun cas la conformite legale de votre site. Les resultats sont " +
  "indicatifs : seule une partie des criteres (environ 30 a 40 % des criteres " +
  "d'accessibilite WCAG) est verifiable automatiquement, et certains constats " +
  "doivent etre confirmes manuellement. Pour toute decision juridique, consultez " +
  "un professionnel du droit.";

/** Penalite appliquee au score (sur 100) par constat confirme. */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critique: 15,
  important: 7,
  mineur: 2,
};

/** Ordre de tri (du plus grave au moins grave). */
export const SEVERITY_ORDER: Record<Severity, number> = {
  critique: 0,
  important: 1,
  mineur: 2,
};

/**
 * Un constat "a_verifier" (heuristique) pese moins lourd qu'un constat confirme
 * pour eviter de penaliser sur la base d'un faux positif potentiel.
 */
export const TO_VERIFY_WEIGHT_FACTOR = 0.4;

// --- Valeurs par defaut du crawler -----------------------------------------

export const DEFAULT_MAX_DEPTH = 2;
export const FREE_MAX_PAGES = 5;
export const PAID_MAX_PAGES = 50;
export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_RETRIES = 1;
/** Temps d'attente apres chargement pour capter les traceurs injectes tard. */
export const POST_LOAD_SETTLE_MS = 1_500;

// --- Tags WCAG utilises par axe-core (A & AA, 2.0/2.1) ----------------------
export const AXE_WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
];
