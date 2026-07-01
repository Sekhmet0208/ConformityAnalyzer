import { describe, expect, it } from 'vitest';
import { LegalMentionsAnalyzer } from '../src/analyzers/legal-mentions.js';
import { makeCrawl, makeLink, makePage } from './helpers/factories.js';

const analyzer = new LegalMentionsAnalyzer();

const FULL_LEGAL_TEXT = `Mentions legales.
  Edite par Boutique Conforme SAS au capital de 10 000 euros.
  Directeur de la publication : Jeanne Dupont.
  Hebergeur : OVH SAS, 2 rue Kellermann, 59100 Roubaix.
  Contact : contact@exemple.fr - 01 23 45 67 89.
  RCS Paris 123 456 789 - SIRET 123 456 789 00012.`;

describe('LegalMentionsAnalyzer', () => {
  it('signale l absence totale de page mentions legales (critique)', async () => {
    const crawl = makeCrawl([
      makePage({ url: 'https://example.com/', links: [makeLink({ text: 'Accueil' })] }),
    ]);
    const findings = await analyzer.analyze(crawl);
    const absent = findings.find((f) => f.id === 'mentions_legales.page_absente');
    expect(absent).toBeDefined();
    expect(absent?.severity).toBe('critique');
    expect(absent?.status).toBe('confirme');
  });

  it('ne signale aucun manque quand la page est complete et liee partout', async () => {
    const legalLink = makeLink({
      text: 'Mentions legales',
      url: 'https://example.com/mentions-legales',
    });
    const crawl = makeCrawl([
      makePage({
        url: 'https://example.com/',
        links: [legalLink],
      }),
      makePage({
        url: 'https://example.com/mentions-legales',
        title: 'Mentions legales',
        visibleText: FULL_LEGAL_TEXT,
        links: [legalLink],
      }),
    ]);
    const findings = await analyzer.analyze(crawl);
    // Aucun element manquant ni page absente.
    expect(findings.some((f) => f.id === 'mentions_legales.page_absente')).toBe(
      false,
    );
    expect(
      findings.filter((f) => f.category === 'mentions_legales' && f.severity !== 'mineur')
        .length,
    ).toBe(0);
  });

  it('detecte les elements manquants sur une page incomplete', async () => {
    const legalLink = makeLink({
      text: 'Mentions legales',
      url: 'https://example.com/mentions-legales',
    });
    const crawl = makeCrawl([
      makePage({ url: 'https://example.com/', links: [legalLink] }),
      makePage({
        url: 'https://example.com/mentions-legales',
        title: 'Mentions legales',
        // Manque hebergeur, directeur de publication, SIRET.
        visibleText:
          'Edite par Boutique SAS. Contact : contact@exemple.fr.',
        links: [legalLink],
      }),
    ]);
    const findings = await analyzer.analyze(crawl);
    expect(
      findings.some((f) => f.id === 'mentions_legales.hebergeur'),
    ).toBe(true);
    expect(
      findings.some((f) => f.id === 'mentions_legales.directeur_publication'),
    ).toBe(true);
  });

  it('signale un lien non present sur toutes les pages (a_verifier)', async () => {
    const legalLink = makeLink({
      text: 'Mentions legales',
      url: 'https://example.com/mentions-legales',
    });
    const crawl = makeCrawl([
      // page d accueil SANS lien mentions legales
      makePage({ url: 'https://example.com/', links: [makeLink({ text: 'Accueil' })] }),
      makePage({
        url: 'https://example.com/mentions-legales',
        title: 'Mentions legales',
        visibleText: FULL_LEGAL_TEXT,
        links: [legalLink],
      }),
    ]);
    const findings = await analyzer.analyze(crawl);
    const partial = findings.find(
      (f) => f.id === 'mentions_legales.lien_non_global',
    );
    expect(partial).toBeDefined();
    expect(partial?.status).toBe('a_verifier');
  });
});
