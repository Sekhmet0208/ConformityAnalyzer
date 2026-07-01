import type { Finding } from '../types.js';
import type {
  CrawlResult,
  ObservedCookie,
  PageCapture,
} from '../crawler/types.js';
import { type Analyzer, makeFinding } from './analyzer.js';
import {
  matchTrackerByCookie,
  matchTrackerByUrl,
} from '../data/tracker-db.js';
import { bareHost } from '../crawler/url-utils.js';

/**
 * Analyseur RGPD / cookies (PRD 3.2).
 *
 * Strategie "constats surs d'abord" (PRD 8) :
 *  - Cookie/traceur necessitant consentement, depose AVANT consentement
 *    -> violation majeure, statut "confirme".
 *  - Absence de mecanisme de consentement alors que des traceurs existent
 *    -> "confirme".
 *  - Possibilite de refuser aussi facilement qu'accepter -> heuristique,
 *    statut "a_verifier".
 *  - Lien vers politique de confidentialite absent -> "confirme" (recoupe avec
 *    l'analyseur mentions legales mais sous l'angle RGPD).
 *  - Formulaire collectant des donnees sans mention de finalite -> "a_verifier".
 */
export class RgpdCookiesAnalyzer implements Analyzer {
  readonly id = 'cookies';

  analyze(crawl: CrawlResult): Finding[] {
    const findings: Finding[] = [];
    const cmpDetected = crawl.stack.cmp !== null;

    // Suivi global pour ne pas dupliquer un meme traceur sur chaque page.
    const reportedTrackersBeforeConsent = new Set<string>();
    const reportedCookiesBeforeConsent = new Set<string>();
    const allTrackerNames = new Set<string>();

    for (const page of crawl.pages) {
      if (page.error) continue;

      this.checkCookiesBeforeConsent(
        page,
        reportedCookiesBeforeConsent,
        findings,
      );
      this.checkTrackerRequestsBeforeConsent(
        page,
        reportedTrackersBeforeConsent,
        allTrackerNames,
        findings,
      );
      this.checkFormsWithoutPurpose(page, findings);
    }

    this.checkPrivacyPolicyLink(crawl, findings);
    this.checkConsentMechanism(
      crawl,
      cmpDetected,
      allTrackerNames,
      findings,
    );
    this.checkRefusalSymmetry(crawl, cmpDetected, allTrackerNames, findings);

    return findings;
  }

  /** Cookies necessitant consentement deposes avant toute acceptation. */
  private checkCookiesBeforeConsent(
    page: PageCapture,
    reported: Set<string>,
    out: Finding[],
  ): void {
    for (const cookie of page.beforeConsent.cookies) {
      const tracker = matchTrackerByCookie(cookie.name);
      if (!tracker || !tracker.requiresConsent) continue;
      const key = `${tracker.id}:${cookie.name}`;
      if (reported.has(key)) continue;
      reported.add(key);
      out.push(
        makeFinding({
          id: 'cookies.pre_consent_cookie',
          category: 'cookies',
          severity: 'critique',
          title: 'Cookie depose avant consentement',
          evidence: {
            url: page.url,
            detail:
              `Le cookie "${cookie.name}" (${tracker.name}) est depose avant ` +
              `toute interaction de consentement.`,
            cookieName: cookie.name,
            cookieDomain: cookie.domain,
            tracker: tracker.name,
          },
          recommendation:
            'Bloquez le depot de ce cookie tant que l\'utilisateur n\'a pas ' +
            'donne son consentement explicite (consentement prealable). ' +
            'Configurez votre gestionnaire de consentement pour conditionner ' +
            'le chargement de ' + tracker.name + '.',
          status: 'confirme',
        }),
      );
    }
  }

  /** Requetes vers des traceurs connus emises avant consentement. */
  private checkTrackerRequestsBeforeConsent(
    page: PageCapture,
    reported: Set<string>,
    allNames: Set<string>,
    out: Finding[],
  ): void {
    for (const req of page.beforeConsent.requests) {
      const tracker = matchTrackerByUrl(req.url);
      if (!tracker) continue;
      allNames.add(tracker.name);
      if (!tracker.requiresConsent) continue;
      if (reported.has(tracker.id)) continue;
      reported.add(tracker.id);
      out.push(
        makeFinding({
          id: 'cookies.pre_consent_tracker',
          category: 'rgpd',
          severity: 'critique',
          title: `Traceur charge avant consentement : ${tracker.name}`,
          evidence: {
            url: page.url,
            detail:
              `Une requete vers ${tracker.name} (${bareHost(req.url)}) est ` +
              `emise avant tout consentement.`,
            requestUrl: req.url,
            tracker: tracker.name,
          },
          recommendation:
            `Ne chargez ${tracker.name} qu\'apres recueil du consentement. ` +
            'Utilisez le mode "consent" / le blocage prealable de votre CMP.',
          status: 'confirme',
        }),
      );
    }
  }

  /** Formulaire de collecte de donnees sans mention de finalite a proximite. */
  private checkFormsWithoutPurpose(page: PageCapture, out: Finding[]): void {
    for (const form of page.forms) {
      const collectsPersonalData = form.fields.some((f) =>
        ['email', 'tel', 'text', 'textarea'].includes(f.type),
      );
      if (!collectsPersonalData) continue;
      if (form.hasPrivacyMention) continue;
      out.push(
        makeFinding({
          id: 'rgpd.form_without_purpose',
          category: 'rgpd',
          severity: 'important',
          title: 'Formulaire de collecte sans mention de finalite',
          evidence: {
            url: page.url,
            detail:
              'Un formulaire collecte des donnees personnelles sans mention ' +
              'visible de la finalite ni lien vers la politique de ' +
              'confidentialite a proximite.',
            action: form.action,
            fields: form.fields.map((f) => f.name || f.type).join(', '),
          },
          recommendation:
            'Ajoutez pres du formulaire une mention indiquant la finalite du ' +
            'traitement, la base legale et un lien vers la politique de ' +
            'confidentialite (information de l\'article 13 du RGPD).',
          // Heuristique : la mention peut exister sous une forme non detectee.
          status: 'a_verifier',
        }),
      );
    }
  }

  /** Au moins un lien vers une politique de confidentialite sur le site. */
  private checkPrivacyPolicyLink(crawl: CrawlResult, out: Finding[]): void {
    const re =
      /(politique\s+de\s+confidentialit|confidentialit[eé]|privacy|donn[eé]es\s+personnelles|protection\s+des\s+donn[eé]es)/i;
    const found = crawl.pages.some(
      (p) =>
        !p.error &&
        p.links.some(
          (l) =>
            re.test(l.text) ||
            /(privacy|confidentialite|confidentialit[eé]|donnees-personnelles|politique-de-confidentialite)/i.test(
              l.url,
            ),
        ),
    );
    if (found) return;
    out.push(
      makeFinding({
        id: 'rgpd.no_privacy_policy_link',
        category: 'rgpd',
        severity: 'important',
        title: 'Lien vers la politique de confidentialite introuvable',
        evidence: {
          url: crawl.rootUrl,
          detail:
            'Aucun lien vers une politique de confidentialite n\'a ete ' +
            'detecte sur les pages analysees.',
        },
        recommendation:
          'Publiez une politique de confidentialite et liez-la depuis toutes ' +
          'les pages (idealement dans le pied de page).',
        status: 'confirme',
      }),
    );
  }

  /** Presence d'un mecanisme de consentement quand des traceurs existent. */
  private checkConsentMechanism(
    crawl: CrawlResult,
    cmpDetected: boolean,
    allNames: Set<string>,
    out: Finding[],
  ): void {
    if (cmpDetected) return;
    // Un bouton d'acceptation a-t-il pu etre clique quelque part ?
    const anyBannerDetected = crawl.pages.some((p) => p.afterConsent !== null);
    const hasTrackers = allNames.size > 0;
    if (!hasTrackers) return; // Pas de traceur : pas d'obligation de banniere.
    if (anyBannerDetected) return; // Une banniere existe meme si CMP non identifiee.

    out.push(
      makeFinding({
        id: 'cookies.no_consent_mechanism',
        category: 'cookies',
        severity: 'critique',
        title: 'Aucun mecanisme de consentement detecte',
        evidence: {
          url: crawl.rootUrl,
          detail:
            'Des traceurs soumis a consentement sont presents mais aucune ' +
            'banniere/CMP n\'a ete detectee. Traceurs : ' +
            [...allNames].join(', ') +
            '.',
        },
        recommendation:
          'Mettez en place un gestionnaire de consentement (CMP) permettant ' +
          'd\'accepter, de refuser et de parametrer les traceurs avant leur ' +
          'depot.',
        status: 'confirme',
      }),
    );
  }

  /**
   * Verifie qu\'on peut refuser aussi facilement qu\'accepter. Heuristique :
   * une banniere a ete cliquee pour "accepter" mais aucun libelle de refus
   * ("tout refuser", "reject all"...) n\'apparait dans le HTML.
   */
  private checkRefusalSymmetry(
    crawl: CrawlResult,
    cmpDetected: boolean,
    allNames: Set<string>,
    out: Finding[],
  ): void {
    const bannerPages = crawl.pages.filter((p) => p.afterConsent !== null);
    if (bannerPages.length === 0) return;
    const refusalRe =
      /(tout\s+refuser|refuser\s+tout|tout\s+rejeter|refuser|reject\s+all|decline|deny|continuer\s+sans\s+accepter)/i;
    const sample = bannerPages[0];
    if (!sample) return;
    if (refusalRe.test(sample.renderedHtml)) return;

    out.push(
      makeFinding({
        id: 'cookies.refusal_not_symmetric',
        category: 'cookies',
        severity: 'important',
        title: 'Refus des cookies possiblement plus difficile que l\'acceptation',
        evidence: {
          url: sample.url,
          detail:
            'Une banniere d\'acceptation a ete detectee mais aucun bouton de ' +
            'refus clair ("Tout refuser") n\'a ete trouve. Le refus doit etre ' +
            'aussi simple que l\'acceptation.',
        },
        recommendation:
          'Ajoutez un bouton "Tout refuser" au meme niveau que "Tout ' +
          'accepter", sans etape supplementaire.',
        // Le bouton de refus peut etre rendu dynamiquement -> a verifier.
        status: 'a_verifier',
      }),
    );
  }
}
