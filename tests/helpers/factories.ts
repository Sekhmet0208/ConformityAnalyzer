import type {
  AxeViolation,
  ConsentPhaseCapture,
  CrawlResult,
  DiscoveredLink,
  FormSnapshot,
  ObservedCookie,
  PageCapture,
} from '../../src/crawler/types.js';
import type { DetectedStack } from '../../src/types.js';

/** Phase de consentement vide. */
export function emptyPhase(
  over: Partial<ConsentPhaseCapture> = {},
): ConsentPhaseCapture {
  return { requests: [], cookies: [], scripts: [], ...over };
}

/** Construit une PageCapture avec des valeurs par defaut surchargables. */
export function makePage(over: Partial<PageCapture> = {}): PageCapture {
  return {
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    statusCode: 200,
    title: 'Accueil',
    htmlLang: 'fr',
    renderedHtml: '<html lang="fr"><body></body></html>',
    visibleText: '',
    links: [],
    forms: [],
    beforeConsent: emptyPhase(),
    afterConsent: null,
    axeViolations: [],
    error: null,
    ...over,
  };
}

export function makeLink(over: Partial<DiscoveredLink> = {}): DiscoveredLink {
  return {
    url: 'https://example.com/page',
    text: '',
    rel: '',
    sameSite: true,
    ...over,
  };
}

export function makeForm(over: Partial<FormSnapshot> = {}): FormSnapshot {
  return {
    action: 'https://example.com/submit',
    method: 'post',
    fields: [],
    hasPrivacyMention: false,
    ...over,
  };
}

export function makeCookie(over: Partial<ObservedCookie> = {}): ObservedCookie {
  return {
    name: 'session',
    domain: 'example.com',
    value: 'x',
    thirdParty: false,
    ...over,
  };
}

export function makeAxeViolation(
  over: Partial<AxeViolation> = {},
): AxeViolation {
  return {
    id: 'image-alt',
    impact: 'critical',
    help: 'Images must have alternate text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
    tags: ['cat.text-alternatives', 'wcag2a', 'wcag111'],
    nodes: [
      {
        target: ['img'],
        html: '<img src="/banner.png">',
        failureSummary: 'Fix this: add an alt attribute.',
      },
    ],
    ...over,
  };
}

export function makeCrawl(
  pages: PageCapture[],
  over: Partial<CrawlResult> = {},
): CrawlResult {
  const stack: DetectedStack = {
    cms: null,
    cmp: null,
    trackers: [],
    ...(over.stack ?? {}),
  };
  const { stack: _ignored, ...rest } = over;
  return {
    rootUrl: 'https://example.com/',
    robotsRespected: true,
    pagesDiscovered: pages.length,
    pages,
    ...rest,
    stack,
  };
}
