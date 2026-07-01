import { describe, expect, it } from 'vitest';
import { RgpdCookiesAnalyzer } from '../src/analyzers/rgpd-cookies.js';
import {
  makeCrawl,
  makeForm,
  makeLink,
  makePage,
} from './helpers/factories.js';

const analyzer = new RgpdCookiesAnalyzer();

describe('RgpdCookiesAnalyzer', () => {
  it('detecte un cookie traceur depose avant consentement (critique, confirme)', () => {
    const crawl = makeCrawl([
      makePage({
        beforeConsent: {
          requests: [],
          scripts: [],
          cookies: [
            { name: '_ga', domain: '.example.com', value: 'x', thirdParty: false },
          ],
        },
      }),
    ]);
    const findings = analyzer.analyze(crawl);
    const pre = findings.find((f) => f.id === 'cookies.pre_consent_cookie');
    expect(pre).toBeDefined();
    expect(pre?.severity).toBe('critique');
    expect(pre?.status).toBe('confirme');
  });

  it('detecte une requete traceur avant consentement', () => {
    const crawl = makeCrawl(
      [
        makePage({
          beforeConsent: {
            cookies: [],
            scripts: [],
            requests: [
              {
                url: 'https://www.google-analytics.com/g/collect?v=2',
                resourceType: 'xhr',
                thirdParty: true,
              },
            ],
          },
        }),
      ],
      { stack: { cms: null, cmp: null, trackers: ['Google Analytics'] } },
    );
    const findings = analyzer.analyze(crawl);
    expect(
      findings.some((f) => f.id === 'cookies.pre_consent_tracker'),
    ).toBe(true);
  });

  it('signale l absence de mecanisme de consentement quand des traceurs existent', () => {
    const crawl = makeCrawl([
      makePage({
        beforeConsent: {
          cookies: [],
          scripts: [],
          requests: [
            {
              url: 'https://connect.facebook.net/fbevents.js',
              resourceType: 'script',
              thirdParty: true,
            },
          ],
        },
        afterConsent: null,
      }),
    ]);
    const findings = analyzer.analyze(crawl);
    expect(
      findings.some((f) => f.id === 'cookies.no_consent_mechanism'),
    ).toBe(true);
  });

  it('signale un formulaire sans mention de finalite (a_verifier)', () => {
    const crawl = makeCrawl([
      makePage({
        forms: [
          makeForm({
            fields: [{ name: 'email', type: 'email', label: 'Email' }],
            hasPrivacyMention: false,
          }),
        ],
      }),
    ]);
    const findings = analyzer.analyze(crawl);
    const form = findings.find((f) => f.id === 'rgpd.form_without_purpose');
    expect(form).toBeDefined();
    expect(form?.status).toBe('a_verifier');
  });

  it('ne signale pas un formulaire avec mention de finalite', () => {
    const crawl = makeCrawl([
      makePage({
        forms: [
          makeForm({
            fields: [{ name: 'email', type: 'email', label: 'Email' }],
            hasPrivacyMention: true,
          }),
        ],
        links: [makeLink({ text: 'Politique de confidentialite' })],
      }),
    ]);
    const findings = analyzer.analyze(crawl);
    expect(
      findings.some((f) => f.id === 'rgpd.form_without_purpose'),
    ).toBe(false);
  });

  it('signale l absence de lien vers la politique de confidentialite', () => {
    const crawl = makeCrawl([makePage({ links: [makeLink({ text: 'Accueil' })] })]);
    const findings = analyzer.analyze(crawl);
    expect(
      findings.some((f) => f.id === 'rgpd.no_privacy_policy_link'),
    ).toBe(true);
  });

  it('ne signale pas l absence de politique si un lien existe', () => {
    const crawl = makeCrawl([
      makePage({
        links: [makeLink({ text: 'Politique de confidentialite', url: 'https://example.com/confidentialite' })],
      }),
    ]);
    const findings = analyzer.analyze(crawl);
    expect(
      findings.some((f) => f.id === 'rgpd.no_privacy_policy_link'),
    ).toBe(false);
  });
});
