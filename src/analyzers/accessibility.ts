import type { Finding, Severity } from '../types.js';
import type { AxeViolation, CrawlResult } from '../crawler/types.js';
import { type Analyzer, makeFinding } from './analyzer.js';

/**
 * Analyseur accessibilite (PRD 3.4) base sur axe-core, restreint aux criteres
 * WCAG 2.1 A & AA automatisables. axe ne remonte que des violations a forte
 * certitude -> tous les findings sont "confirme".
 *
 * Couverture explicite demandee par le PRD :
 *  - images sans `alt`            -> regle axe "image-alt"
 *  - contraste insuffisant        -> regle axe "color-contrast"
 *  - langue de page               -> regles "html-has-lang" / "html-lang-valid"
 *  - structure de titres          -> regles "heading-order", "empty-heading",
 *                                    "page-has-heading-one"
 * (cf. docs/WCAG-COVERAGE.md pour la liste complete couvert / non couvert).
 */
export class AccessibilityAnalyzer implements Analyzer {
  readonly id = 'accessibilite';

  analyze(crawl: CrawlResult): Finding[] {
    const findings: Finding[] = [];
    // Dedoublonnage : une meme regle axe peut echouer sur plusieurs pages.
    // On remonte un finding par (regle, page) mais on agrege le nombre de noeuds.
    for (const page of crawl.pages) {
      if (page.error) continue;
      for (const v of page.axeViolations) {
        findings.push(this.toFinding(page.url, v));
      }
    }
    return findings;
  }

  private toFinding(pageUrl: string, v: AxeViolation): Finding {
    const wcagRef = extractWcagRef(v.tags);
    const nodeCount = v.nodes.length;
    const firstNode = v.nodes[0];
    return makeFinding({
      id: `accessibilite.${v.id}`,
      category: 'accessibilite',
      severity: mapImpact(v.impact),
      title: v.help,
      evidence: {
        url: pageUrl,
        selector: firstNode?.target.join(' ') ?? undefined,
        detail:
          `${nodeCount} element(s) concerne(s). ` +
          (firstNode?.failureSummary ?? '') +
          ` (Reference axe : ${v.helpUrl})`,
        ruleId: v.id,
        nodeCount,
        sampleHtml: firstNode?.html,
      },
      recommendation: recommendationFor(v.id, v.help),
      ...(wcagRef ? { wcag_ref: wcagRef } : {}),
      status: 'confirme',
    });
  }
}

/** Convertit l'impact axe en severite normalisee. */
function mapImpact(impact: AxeViolation['impact']): Severity {
  switch (impact) {
    case 'critical':
    case 'serious':
      return 'important';
    case 'moderate':
      return 'mineur';
    case 'minor':
      return 'mineur';
    default:
      return 'mineur';
  }
}

/**
 * Extrait une reference WCAG "x.y.z" a partir des tags axe (ex: "wcag111" ->
 * "1.1.1"). Renvoie le premier critere reconnu, ou undefined.
 */
function extractWcagRef(tags: string[]): string | undefined {
  for (const tag of tags) {
    const m = /^wcag(\d)(\d)(\d+)$/.exec(tag);
    if (m) {
      return `${m[1]}.${m[2]}.${m[3]}`;
    }
  }
  return undefined;
}

/** Recommandations ciblees pour les regles les plus courantes. */
function recommendationFor(ruleId: string, fallback: string): string {
  const map: Record<string, string> = {
    'image-alt':
      'Ajoutez un attribut alt decrivant chaque image porteuse de sens ; ' +
      'utilisez alt="" pour les images purement decoratives.',
    'color-contrast':
      'Augmentez le contraste entre le texte et son arriere-plan (ratio min. ' +
      '4,5:1 pour le texte normal, 3:1 pour le grand texte).',
    'html-has-lang':
      'Declarez la langue principale de la page via l\'attribut lang sur la ' +
      'balise <html> (ex: <html lang="fr">).',
    'html-lang-valid':
      'Corrigez la valeur de l\'attribut lang pour qu\'elle corresponde a un ' +
      'code de langue valide (ex: "fr", "en").',
    'heading-order':
      'Respectez une hierarchie de titres coherente (h1 puis h2, h3... sans ' +
      'saut de niveau).',
    'link-name':
      'Donnez un intitule explicite a chaque lien (texte visible ou ' +
      'aria-label) decrivant sa destination.',
    'label':
      'Associez une etiquette <label> a chaque champ de formulaire.',
    'document-title':
      'Ajoutez une balise <title> descriptive a la page.',
    'button-name':
      'Donnez un intitule accessible a chaque bouton (texte ou aria-label).',
  };
  return map[ruleId] ?? fallback;
}
