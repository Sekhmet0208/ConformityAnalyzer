import type { Finding } from '../types.js';
import type { CrawlResult } from '../crawler/types.js';

/**
 * Contrat commun a tous les modules d'analyse (PRD 4 : "modules d'analyse
 * independants et composables, chacun renvoyant des findings normalises").
 *
 * Un analyseur recoit le resultat brut du crawl et renvoie une liste de
 * findings au format §5.2. Il est pur (pas d'I/O) et donc facilement testable
 * avec des fixtures.
 */
export interface Analyzer {
  /** Identifiant lisible du module (ex: "cookies"). */
  readonly id: string;
  analyze(crawl: CrawlResult): Promise<Finding[]> | Finding[];
}

/** Construit un finding en garantissant tous les champs du format normalise. */
export function makeFinding(input: Omit<Finding, 'locked'> & {
  locked?: boolean;
}): Finding {
  return {
    id: input.id,
    category: input.category,
    severity: input.severity,
    title: input.title,
    evidence: input.evidence,
    recommendation: input.recommendation,
    ...(input.wcag_ref ? { wcag_ref: input.wcag_ref } : {}),
    status: input.status,
    // Verrouillage par defaut a true : le freemium masque les details (PRD 1.3).
    locked: input.locked ?? true,
  };
}
