import 'server-only';
import type { ScanResult } from './contract';
import type { ScanRow, UserRow } from './db';

/**
 * Logique de droits (paywall) appliquee a la LECTURE d'un rapport.
 *
 * Principe : le scan est stocke complet (non caviarde). On decide a la lecture
 * si le visiteur a le droit de voir le detail. Cela permet de "debloquer le
 * detail du meme scan" apres paiement (PRD §6) sans relancer le scan.
 *
 * Un scan est deverrouille si :
 *   - il a ete cree en mode dev deverrouille (`dev_unlocked`), OU
 *   - le visiteur est le proprietaire ET son compte a le plan "paid".
 */
export function isScanUnlocked(
  scan: ScanRow,
  user: UserRow | null,
): boolean {
  if (scan.dev_unlocked === 1) return true;
  if (user && scan.user_id === user.id && user.plan === 'paid') return true;
  return false;
}

const LOCKED_MESSAGE = 'Verrouille — passez a une offre payante.';

/**
 * Renvoie une copie du rapport adaptee aux droits du visiteur.
 *  - deverrouille : tous les findings `locked: false`, preuves intactes.
 *  - verrouille   : tous `locked: true`, preuves et recommandations masquees.
 */
export function redactForViewer(
  report: ScanResult,
  unlocked: boolean,
): ScanResult {
  if (unlocked) {
    return {
      ...report,
      findings: report.findings.map((f) => ({ ...f, locked: false })),
    };
  }
  return {
    ...report,
    findings: report.findings.map((f) => ({
      ...f,
      locked: true,
      evidence: { detail: LOCKED_MESSAGE },
      recommendation: LOCKED_MESSAGE,
    })),
  };
}

/**
 * Determine le palier de crawl d'un nouveau scan et s'il doit etre deverrouille
 * en mode dev.
 *  - utilisateur "paid" -> scan complet (50 pages), deverrouille par son abo.
 *  - sinon, override dev + demande "paid" -> scan complet, deverrouille (dev).
 *  - sinon -> scan gratuit (5 pages), verrouille.
 */
export function resolveScanTier(
  user: UserRow | null,
  requestedTier: unknown,
  devOverrideAllowed: boolean,
): { tier: 'free' | 'paid'; devUnlocked: boolean } {
  if (user && user.plan === 'paid') {
    return { tier: 'paid', devUnlocked: false };
  }
  if (devOverrideAllowed && requestedTier === 'paid') {
    return { tier: 'paid', devUnlocked: true };
  }
  return { tier: 'free', devUnlocked: false };
}

/**
 * La generation de documents est une fonctionnalite PAYANTE (PRD §1.4 : "un
 * utilisateur payant peut generer au moins 2 documents"). Autorisee si le
 * compte est abonne, ou en mode override dev.
 */
export function canGenerateDocuments(
  user: UserRow | null,
  devOverrideAllowed: boolean,
): boolean {
  if (user && user.plan === 'paid') return true;
  if (devOverrideAllowed) return true;
  return false;
}
