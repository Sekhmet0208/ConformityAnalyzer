import type { Finding } from '../types.js';
import type { CrawlResult, PageCapture } from '../crawler/types.js';
import { type Analyzer, makeFinding } from './analyzer.js';
import {
  HeuristicLegalExtractor,
  LEGAL_ELEMENT_LABELS,
  type ElementPresence,
  type LegalChecklist,
  type LegalElement,
  type LegalExtractor,
} from './legal-extract.js';

/**
 * Analyseur mentions legales (PRD 3.3, droit francais en v1).
 *
 * Methode (PRD 3.3) :
 *  1. detecter les pages candidates par URL / ancre / titre ;
 *  2. extraire (LLM ou heuristique) la presence de chaque element obligatoire ;
 *  3. produire une checklist (present / manquant / incertain).
 *
 * L'extracteur est injectable : on branche l'heuristique deterministe par
 * defaut (testable hors-ligne), un extracteur LLM pourra le remplacer.
 */
export class LegalMentionsAnalyzer implements Analyzer {
  private readonly extractor: LegalExtractor;

  constructor(extractor: LegalExtractor = new HeuristicLegalExtractor()) {
    this.extractor = extractor;
  }

  readonly id = 'mentions_legales';

  async analyze(crawl: CrawlResult): Promise<Finding[]> {
    const findings: Finding[] = [];

    const accessibleFromAll = this.linkPresentOnAllPages(crawl);
    const candidate = this.findLegalPage(crawl);

    if (!candidate) {
      findings.push(
        makeFinding({
          id: 'mentions_legales.page_absente',
          category: 'mentions_legales',
          severity: 'critique',
          title: 'Page "Mentions legales" introuvable',
          evidence: {
            url: crawl.rootUrl,
            detail:
              'Aucune page de mentions legales n\'a ete detectee (ni par URL, ' +
              'ni par lien, ni par titre).',
          },
          recommendation:
            'Publiez une page "Mentions legales" et liez-la depuis toutes les ' +
            'pages (obligation des articles 6-III LCEN). Elle doit mentionner ' +
            'l\'editeur, l\'hebergeur, le directeur de publication et un contact.',
          status: 'confirme',
        }),
      );
      return findings;
    }

    if (!accessibleFromAll) {
      findings.push(
        makeFinding({
          id: 'mentions_legales.lien_non_global',
          category: 'mentions_legales',
          severity: 'important',
          title: 'Lien "Mentions legales" absent de certaines pages',
          evidence: {
            url: candidate.url,
            detail:
              'La page de mentions legales existe mais n\'est pas liee depuis ' +
              'toutes les pages analysees. Elle doit etre accessible partout ' +
              '(generalement via le pied de page).',
          },
          recommendation:
            'Ajoutez le lien vers les mentions legales dans le pied de page ' +
            'commun a toutes les pages.',
          status: 'a_verifier',
        }),
      );
    }

    const checklist = await this.extractor.extract(candidate.visibleText);
    findings.push(...this.checklistToFindings(candidate, checklist));
    return findings;
  }

  /** Detecte la page de mentions legales la plus probable. */
  private findLegalPage(crawl: CrawlResult): PageCapture | null {
    const urlRe =
      /(mentions?[-_]?legales?|mentions?[-_]?l[eé]gales?|legal[-_]?notice|legal[-_]?mentions|\/legal\b|impressum)/i;
    const titleRe = /(mentions\s+l[eé]gales|legal\s+notice|impressum)/i;
    const anchorRe = /mentions\s+l[eé]gales|legal\s+notice|impressum/i;

    // 1) Page dont l'URL correspond.
    for (const p of crawl.pages) {
      if (p.error) continue;
      if (urlRe.test(p.url)) return p;
    }
    // 2) Page dont le titre correspond.
    for (const p of crawl.pages) {
      if (p.error) continue;
      if (titleRe.test(p.title)) return p;
    }
    // 3) Page ciblee par une ancre "Mentions legales".
    for (const p of crawl.pages) {
      if (p.error) continue;
      const target = p.links.find((l) => anchorRe.test(l.text));
      if (target) {
        const dest = crawl.pages.find(
          (q) => !q.error && q.url === target.url,
        );
        if (dest) return dest;
      }
    }
    return null;
  }

  /** Le lien vers les mentions legales est-il present sur toutes les pages ? */
  private linkPresentOnAllPages(crawl: CrawlResult): boolean {
    const anchorRe = /mentions\s+l[eé]gales|legal\s+notice|impressum/i;
    const urlRe = /(mentions?[-_]?legales?|legal[-_]?notice|\/legal\b|impressum)/i;
    const pages = crawl.pages.filter((p) => !p.error);
    if (pages.length === 0) return false;
    return pages.every((p) =>
      p.links.some((l) => anchorRe.test(l.text) || urlRe.test(l.url)),
    );
  }

  private checklistToFindings(
    page: PageCapture,
    checklist: LegalChecklist,
  ): Finding[] {
    const out: Finding[] = [];
    const elements: LegalElement[] = [
      'editeur',
      'hebergeur',
      'directeur_publication',
      'contact',
      'siret_rcs',
    ];
    for (const el of elements) {
      const presence = checklist[el];
      if (presence === 'present') continue;
      out.push(this.elementFinding(page, el, presence));
    }
    return out;
  }

  private elementFinding(
    page: PageCapture,
    element: LegalElement,
    presence: Exclude<ElementPresence, 'present'>,
  ): Finding {
    const label = LEGAL_ELEMENT_LABELS[element];
    const missing = presence === 'manquant';
    return makeFinding({
      id: `mentions_legales.${element}`,
      category: 'mentions_legales',
      // SIRET/RCS peut ne pas s'appliquer (association, particulier) -> mineur.
      severity: element === 'siret_rcs' ? 'mineur' : 'important',
      title: missing
        ? `Mention legale manquante : ${label}`
        : `Mention legale a verifier : ${label}`,
      evidence: {
        url: page.url,
        detail: missing
          ? `L'element "${label}" n'a pas ete trouve dans les mentions legales.`
          : `L'element "${label}" n'a pas pu etre confirme automatiquement.`,
        element,
      },
      recommendation: recommendationFor(element),
      // "manquant" = constat sur ; "incertain" = a verifier.
      status: missing ? 'confirme' : 'a_verifier',
    });
  }
}

function recommendationFor(element: LegalElement): string {
  switch (element) {
    case 'editeur':
      return (
        "Indiquez l'identite de l'editeur : pour une societe, denomination, " +
        'forme juridique, capital, siege ; pour un particulier, nom et prenom.'
      );
    case 'hebergeur':
      return (
        "Indiquez le nom, la denomination et l'adresse ainsi que le telephone " +
        "de l'hebergeur du site."
      );
    case 'directeur_publication':
      return 'Indiquez le nom du directeur ou de la directrice de la publication.';
    case 'contact':
      return (
        'Ajoutez un moyen de contact direct : adresse email et/ou telephone ' +
        'et/ou adresse postale.'
      );
    case 'siret_rcs':
      return (
        "Si vous etes immatricule, indiquez le numero RCS et le SIRET ainsi " +
        'que le numero de TVA intracommunautaire le cas echeant.'
      );
  }
}
