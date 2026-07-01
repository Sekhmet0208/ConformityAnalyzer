/** Point d'entree programmatique du coeur de scan (Lot 1). */
export { runScan, runAnalyzers, defaultAnalyzers } from './scan.js';
export type { ScanOptions } from './scan.js';
export { Crawler } from './crawler/crawler.js';
export type { CrawlOptions } from './crawler/crawler.js';
export { buildReport, redactLocked } from './report/report.js';
export {
  computeScore,
  gradeFromScore,
  prioritize,
  summarize,
} from './report/score.js';
export { renderText } from './report/render-text.js';

export { RgpdCookiesAnalyzer } from './analyzers/rgpd-cookies.js';
export { AccessibilityAnalyzer } from './analyzers/accessibility.js';
export { LegalMentionsAnalyzer } from './analyzers/legal-mentions.js';
export { makeFinding } from './analyzers/analyzer.js';
export type { Analyzer } from './analyzers/analyzer.js';
export {
  HeuristicLegalExtractor,
} from './analyzers/legal-extract.js';
export type {
  LegalExtractor,
  LegalChecklist,
  LegalElement,
} from './analyzers/legal-extract.js';

export { RobotsTxt } from './crawler/robots.js';
export {
  matchTrackerByUrl,
  matchTrackerByCookie,
  matchConsentManagerByUrl,
} from './data/tracker-db.js';

export { LEGAL_DISCLAIMER, BOT_USER_AGENT } from './constants.js';
export * from './types.js';
