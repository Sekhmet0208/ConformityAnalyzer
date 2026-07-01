import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import {
  BOT_USER_AGENT,
  DEFAULT_MAX_DEPTH,
  DEFAULT_RETRIES,
  DEFAULT_TIMEOUT_MS,
  FREE_MAX_PAGES,
  PAID_MAX_PAGES,
  POST_LOAD_SETTLE_MS,
} from '../constants.js';
import type { DetectedStack, Tier } from '../types.js';
import { RobotsTxt } from './robots.js';
import {
  bareHost,
  isSameSite,
  isThirdParty,
  normalizeUrl,
} from './url-utils.js';
import { extractInPage } from './page-extract.js';
import { detectAndAccept } from './consent.js';
import { detectCms } from './stack-detect.js';
import { runAxe } from './axe-runner.js';
import {
  matchConsentManagerByUrl,
  matchTrackerByUrl,
} from '../data/tracker-db.js';
import type {
  ConsentPhaseCapture,
  CrawlResult,
  DiscoveredLink,
  FormSnapshot,
  LoadedScript,
  NetworkRequest,
  ObservedCookie,
  PageCapture,
} from './types.js';

export interface CrawlOptions {
  rootUrl: string;
  tier: Tier;
  maxDepth?: number;
  maxPages?: number;
  timeoutMs?: number;
  retries?: number;
  respectRobots?: boolean;
  /** Injectable pour les tests (par defaut chromium reel). */
  launch?: () => Promise<Browser>;
}

/** Mots-cles d'URL pour reperer une mention de consentement a proximite d'un form. */
const PRIVACY_HINT_WORDS = [
  'consent',
  'consentement',
  'finalit',
  'donnees personnelles',
  'données personnelles',
  'politique de confidentialit',
  'rgpd',
  'gdpr',
  'newsletter',
  'vos informations',
  "j'accepte",
];

export class Crawler {
  private readonly opts: Required<Omit<CrawlOptions, 'launch'>> & {
    launch?: () => Promise<Browser>;
  };

  constructor(options: CrawlOptions) {
    const maxPages =
      options.maxPages ??
      (options.tier === 'paid' ? PAID_MAX_PAGES : FREE_MAX_PAGES);
    this.opts = {
      rootUrl: options.rootUrl,
      tier: options.tier,
      maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
      maxPages,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      retries: options.retries ?? DEFAULT_RETRIES,
      respectRobots: options.respectRobots ?? true,
      launch: options.launch,
    };
  }

  async crawl(): Promise<CrawlResult> {
    const root = normalizeUrl(this.opts.rootUrl);
    if (!root) {
      throw new Error(`URL racine invalide : ${this.opts.rootUrl}`);
    }

    // Si un navigateur est injecte (tests, pool partage), on ne le ferme pas :
    // sa duree de vie appartient a l'appelant.
    const ownsBrowser = !this.opts.launch;
    const browser = await (this.opts.launch
      ? this.opts.launch()
      : chromium.launch({ headless: true }));

    const robots = this.opts.respectRobots
      ? await this.fetchRobots(browser, root)
      : RobotsTxt.allowAll();

    const pages: PageCapture[] = [];
    const visited = new Set<string>();
    const queue: { url: string; depth: number }[] = [{ url: root, depth: 0 }];
    let discovered = 1;

    const allScripts: LoadedScript[] = [];
    let detectedCmp: string | null = null;

    try {
      while (queue.length > 0 && pages.length < this.opts.maxPages) {
        const next = queue.shift();
        if (!next) break;
        const { url, depth } = next;
        if (visited.has(url)) continue;
        visited.add(url);

        if (
          this.opts.respectRobots &&
          !robots.isAllowed(new URL(url).pathname, BOT_USER_AGENT)
        ) {
          continue;
        }

        const capture = await this.capturePage(browser, url, root);
        pages.push(capture);
        allScripts.push(...capture.beforeConsent.scripts);

        // Detection CMP a partir des scripts charges.
        if (!detectedCmp) {
          for (const s of capture.beforeConsent.scripts) {
            if (s.src) {
              const cmp = matchConsentManagerByUrl(s.src);
              if (cmp) {
                detectedCmp = cmp.name;
                break;
              }
            }
          }
        }

        // Enfile les liens internes dans la limite de profondeur.
        if (depth < this.opts.maxDepth) {
          for (const link of capture.links) {
            if (!link.sameSite) continue;
            if (link.rel.toLowerCase().includes('nofollow')) continue;
            const norm = normalizeUrl(link.url, url);
            if (!norm || visited.has(norm)) continue;
            if (queue.some((q) => q.url === norm)) continue;
            if (
              this.opts.respectRobots &&
              !robots.isAllowed(new URL(norm).pathname, BOT_USER_AGENT)
            ) {
              continue;
            }
            queue.push({ url: norm, depth: depth + 1 });
            discovered++;
          }
        }
      }
    } finally {
      if (ownsBrowser) await browser.close();
    }

    const stack: DetectedStack = {
      cms: detectCms(pages[0]?.renderedHtml ?? '', allScripts),
      cmp: detectedCmp,
      trackers: this.collectTrackerNames(allScripts),
    };

    return {
      rootUrl: root,
      robotsRespected: this.opts.respectRobots,
      pagesDiscovered: discovered,
      pages,
      stack,
    };
  }

  private collectTrackerNames(scripts: LoadedScript[]): string[] {
    const names = new Set<string>();
    for (const s of scripts) {
      if (!s.src) continue;
      const t = matchTrackerByUrl(s.src);
      if (t) names.add(t.name);
    }
    return [...names];
  }

  private async fetchRobots(
    browser: Browser,
    root: string,
  ): Promise<RobotsTxt> {
    try {
      const robotsUrl = new URL('/robots.txt', root).toString();
      const ctx = await browser.newContext({ userAgent: BOT_USER_AGENT });
      const resp = await ctx
        .request.get(robotsUrl, { timeout: this.opts.timeoutMs })
        .catch(() => null);
      let parsed = RobotsTxt.allowAll();
      if (resp && resp.ok()) {
        const body = await resp.text();
        parsed = RobotsTxt.parse(body);
      }
      await ctx.close();
      return parsed;
    } catch {
      return RobotsTxt.allowAll();
    }
  }

  /** Capture une page : reseau/cookies avant, puis apres consentement simule. */
  private async capturePage(
    browser: Browser,
    url: string,
    root: string,
  ): Promise<PageCapture> {
    let attempt = 0;
    let lastError: string | null = null;

    while (attempt <= this.opts.retries) {
      const context = await browser.newContext({
        userAgent: BOT_USER_AGENT,
        ignoreHTTPSErrors: true,
        locale: 'fr-FR',
      });
      const requests: NetworkRequest[] = [];
      context.on('request', (req) => {
        requests.push({
          url: req.url(),
          resourceType: req.resourceType(),
          thirdParty: isThirdParty(req.url(), root),
        });
      });

      const page = await context.newPage();
      try {
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: this.opts.timeoutMs,
        });
        await page
          .waitForLoadState('networkidle', { timeout: 5_000 })
          .catch(() => undefined);
        await page.waitForTimeout(POST_LOAD_SETTLE_MS);

        const beforeRequests = [...requests];
        const beforeCookies = await this.readCookies(context, root);
        const beforeData = await extractInPage(page);
        const beforeScripts = this.toScripts(beforeData.scripts, url, root);

        // Audit accessibilite (axe-core) sur l'etat initial de la page.
        const axeViolations = await runAxe(page);

        // --- Phase consentement ------------------------------------------
        const consent = await detectAndAccept(page);
        let afterConsent: ConsentPhaseCapture | null = null;
        if (consent.accepted) {
          await page
            .waitForLoadState('networkidle', { timeout: 5_000 })
            .catch(() => undefined);
          await page.waitForTimeout(POST_LOAD_SETTLE_MS);
          const afterData = await extractInPage(page);
          afterConsent = {
            requests: [...requests],
            cookies: await this.readCookies(context, root),
            scripts: this.toScripts(afterData.scripts, url, root),
          };
        }

        const capture: PageCapture = {
          url,
          finalUrl: page.url(),
          statusCode: response?.status() ?? null,
          title: beforeData.title,
          htmlLang: beforeData.htmlLang,
          renderedHtml: beforeData.html,
          visibleText: beforeData.visibleText,
          links: this.toLinks(beforeData.links, url),
          forms: this.toForms(beforeData.forms),
          beforeConsent: {
            requests: beforeRequests,
            cookies: beforeCookies,
            scripts: beforeScripts,
          },
          afterConsent,
          axeViolations,
          error: null,
        };
        await context.close();
        return capture;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        await context.close().catch(() => undefined);
        attempt++;
      }
    }

    // Echec apres retries : page minimale avec erreur.
    return {
      url,
      finalUrl: url,
      statusCode: null,
      title: '',
      htmlLang: null,
      renderedHtml: '',
      visibleText: '',
      links: [],
      forms: [],
      beforeConsent: { requests: [], cookies: [], scripts: [] },
      afterConsent: null,
      axeViolations: [],
      error: lastError,
    };
  }

  private async readCookies(
    context: BrowserContext,
    root: string,
  ): Promise<ObservedCookie[]> {
    const cookies = await context.cookies().catch(() => []);
    return cookies.map((c) => ({
      name: c.name,
      domain: c.domain,
      value: c.value,
      thirdParty: isThirdParty(`https://${c.domain.replace(/^\./, '')}`, root),
    }));
  }

  private toScripts(
    raw: { src: string | null; inline: boolean }[],
    pageUrl: string,
    root: string,
  ): LoadedScript[] {
    return raw.map((s) => {
      const abs = s.src ? normalizeUrl(s.src, pageUrl) : null;
      return {
        src: abs,
        inline: s.inline,
        thirdParty: abs ? isThirdParty(abs, root) : false,
      };
    });
  }

  private toLinks(
    raw: { href: string; text: string; rel: string }[],
    pageUrl: string,
  ): DiscoveredLink[] {
    const out: DiscoveredLink[] = [];
    for (const l of raw) {
      const abs = normalizeUrl(l.href, pageUrl);
      if (!abs) continue;
      out.push({
        url: abs,
        text: l.text,
        rel: l.rel,
        sameSite: isSameSite(abs, pageUrl),
      });
    }
    return out;
  }

  private toForms(
    raw: {
      action: string;
      method: string;
      fields: { name: string; type: string; label: string | null }[];
      nearbyText: string;
    }[],
  ): FormSnapshot[] {
    return raw.map((f) => {
      const haystack = (
        f.nearbyText +
        ' ' +
        f.fields.map((x) => `${x.name} ${x.label ?? ''}`).join(' ')
      ).toLowerCase();
      const hasPrivacyMention = PRIVACY_HINT_WORDS.some((w) =>
        haystack.includes(w),
      );
      return {
        action: f.action,
        method: f.method,
        fields: f.fields,
        hasPrivacyMention,
      };
    });
  }
}

/** Pratique : nom d'hote nu de la racine (utilise dans les logs/CLI). */
export function rootLabel(url: string): string {
  return bareHost(url);
}
