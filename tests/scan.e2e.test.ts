import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { runScan } from '../src/scan.js';
import { serveFixture, type FixtureServer } from './helpers/fixture-server.js';

/**
 * Tests d'integration bout-en-bout : vrai navigateur Chromium + serveur de
 * fixtures local. Valide les criteres de succes du MVP (PRD 1.4) : un site non
 * conforme remonte les bons constats, un site conforme en remonte peu.
 *
 * Necessite Chromium installe : `npm run browsers` (playwright install chromium).
 */
describe('scan end-to-end (fixtures + chromium)', () => {
  let browser: Browser;
  const launch = () => Promise.resolve(browser);

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  it('site NON conforme : remonte cookies pre-consentement, mentions absentes et a11y', async () => {
    let srv: FixtureServer | undefined;
    try {
      srv = await serveFixture('non-compliant');
      const report = await runScan({
        url: srv.origin,
        tier: 'paid',
        maxPages: 3,
        // localhost : robots non pertinent, on desactive pour le test.
        respectRobots: false,
        launch,
      });

      const ids = report.findings.map((f) => f.id);

      // RGPD / cookies : cookie _ga depose avant consentement.
      expect(ids).toContain('cookies.pre_consent_cookie');
      // Mentions legales : page absente.
      expect(ids).toContain('mentions_legales.page_absente');
      // Politique de confidentialite : lien absent.
      expect(ids).toContain('rgpd.no_privacy_policy_link');
      // Formulaire sans finalite.
      expect(ids).toContain('rgpd.form_without_purpose');
      // Accessibilite : au moins une violation axe (image-alt / contrast / lang).
      expect(
        report.findings.some((f) => f.category === 'accessibilite'),
      ).toBe(true);

      // Score degrade et note basse.
      expect(report.score).toBeLessThan(60);
      // Le disclaimer est toujours present.
      expect(report.disclaimer.length).toBeGreaterThan(0);
    } finally {
      await srv?.close();
    }
  });

  it('site conforme : peu de constats, pas de violation majeure RGPD/mentions', async () => {
    let srv: FixtureServer | undefined;
    try {
      srv = await serveFixture('compliant');
      const report = await runScan({
        url: srv.origin,
        tier: 'paid',
        maxPages: 5,
        respectRobots: false,
        launch,
      });

      const ids = report.findings.map((f) => f.id);

      // Pas de cookie traceur avant consentement.
      expect(ids).not.toContain('cookies.pre_consent_cookie');
      // La page de mentions legales est trouvee et complete.
      expect(ids).not.toContain('mentions_legales.page_absente');
      expect(ids).not.toContain('mentions_legales.hebergeur');
      expect(ids).not.toContain('mentions_legales.directeur_publication');
      // Le lien vers la politique de confidentialite est present.
      expect(ids).not.toContain('rgpd.no_privacy_policy_link');

      // Score nettement meilleur que le site non conforme.
      expect(report.score).toBeGreaterThan(80);
    } finally {
      await srv?.close();
    }
  });

  it('respecte robots.txt (Disallow: / bloque tout sauf la racine demandee)', async () => {
    let srv: FixtureServer | undefined;
    try {
      srv = await serveFixture('compliant', {
        robots: 'User-agent: *\nDisallow: /produits\nDisallow: /confidentialite',
      });
      const report = await runScan({
        url: srv.origin,
        tier: 'paid',
        maxPages: 10,
        respectRobots: true,
        launch,
      });
      // Les pages interdites ne doivent pas avoir ete crawlees.
      // (on verifie indirectement : aucune evidence ne pointe vers /produits)
      const urls = report.findings
        .map((f) => f.evidence.url ?? '')
        .join(' ');
      expect(urls).not.toMatch(/\/produits/);
    } finally {
      await srv?.close();
    }
  });
});
