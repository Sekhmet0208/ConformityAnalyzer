import type { DetectedStack } from '../types.js';

/** Une requete reseau observee pendant le chargement d'une page. */
export interface NetworkRequest {
  url: string;
  resourceType: string;
  /** true si le domaine est tiers par rapport au site racine. */
  thirdParty: boolean;
}

/** Un cookie observe (forme simplifiee de l'objet Playwright). */
export interface ObservedCookie {
  name: string;
  domain: string;
  value: string;
  /** true si depose par un domaine tiers. */
  thirdParty: boolean;
}

/** Un script charge dans la page (URL externe ou inline). */
export interface LoadedScript {
  /** URL pour un script externe, null pour un script inline. */
  src: string | null;
  inline: boolean;
  thirdParty: boolean;
}

/** Un lien decouvert dans la page (pour le crawl et l'analyse). */
export interface DiscoveredLink {
  url: string;
  text: string;
  rel: string;
  sameSite: boolean;
}

/** Champ de formulaire simplifie (pour l'analyse RGPD des formulaires). */
export interface FormSnapshot {
  action: string;
  method: string;
  /** Types/noms des champs de saisie. */
  fields: { name: string; type: string; label: string | null }[];
  /** true si un texte de finalite/consentement est detecte a proximite. */
  hasPrivacyMention: boolean;
}

/** Un noeud fautif remonte par axe-core (forme reduite). */
export interface AxeNode {
  target: string[];
  html: string;
  failureSummary: string | null;
}

/** Une violation axe-core (forme reduite, sans dependance de type externe). */
export interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  help: string;
  helpUrl: string;
  /** Tags axe (ex: "wcag2a", "wcag111"). */
  tags: string[];
  nodes: AxeNode[];
}

/**
 * Etat reseau/cookies capture a un instant donne (avant ou apres consentement).
 */
export interface ConsentPhaseCapture {
  requests: NetworkRequest[];
  cookies: ObservedCookie[];
  scripts: LoadedScript[];
}

/** Tout ce que le crawler capture pour UNE page. */
export interface PageCapture {
  url: string;
  finalUrl: string;
  statusCode: number | null;
  title: string;
  /** Langue declaree (<html lang="...">), ou null. */
  htmlLang: string | null;
  /** HTML rendu apres execution JS. */
  renderedHtml: string;
  /** Texte visible (utile pour l'extraction mentions legales). */
  visibleText: string;
  links: DiscoveredLink[];
  forms: FormSnapshot[];
  /** Capture realisee avant toute interaction de consentement. */
  beforeConsent: ConsentPhaseCapture;
  /**
   * Capture realisee apres simulation d'acceptation, si un mecanisme de
   * consentement a ete detecte/clique. null sinon.
   */
  afterConsent: ConsentPhaseCapture | null;
  /** Violations d'accessibilite remontees par axe-core sur cette page. */
  axeViolations: AxeViolation[];
  /** Erreur de chargement eventuelle (timeout, DNS...). */
  error: string | null;
}

/** Resultat global du crawl, transmis aux analyseurs. */
export interface CrawlResult {
  rootUrl: string;
  robotsRespected: boolean;
  pagesDiscovered: number;
  pages: PageCapture[];
  stack: DetectedStack;
}
