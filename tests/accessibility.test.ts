import { describe, expect, it } from 'vitest';
import { AccessibilityAnalyzer } from '../src/analyzers/accessibility.js';
import { makeAxeViolation, makeCrawl, makePage } from './helpers/factories.js';

const analyzer = new AccessibilityAnalyzer();

describe('AccessibilityAnalyzer', () => {
  it('convertit une violation axe en finding normalise avec ref WCAG', () => {
    const crawl = makeCrawl([
      makePage({ axeViolations: [makeAxeViolation()] }),
    ]);
    const findings = analyzer.analyze(crawl);
    expect(findings).toHaveLength(1);
    const fnd = findings[0]!;
    expect(fnd.category).toBe('accessibilite');
    expect(fnd.id).toBe('accessibilite.image-alt');
    expect(fnd.wcag_ref).toBe('1.1.1');
    expect(fnd.status).toBe('confirme');
  });

  it('mappe impact critical/serious -> important, moderate/minor -> mineur', () => {
    const crawl = makeCrawl([
      makePage({
        axeViolations: [
          makeAxeViolation({ id: 'color-contrast', impact: 'serious', tags: ['wcag2aa', 'wcag143'] }),
          makeAxeViolation({ id: 'heading-order', impact: 'moderate', tags: ['cat.semantics', 'best-practice'] }),
        ],
      }),
    ]);
    const findings = analyzer.analyze(crawl);
    const contrast = findings.find((f) => f.id === 'accessibilite.color-contrast');
    const heading = findings.find((f) => f.id === 'accessibilite.heading-order');
    expect(contrast?.severity).toBe('important');
    expect(contrast?.wcag_ref).toBe('1.4.3');
    expect(heading?.severity).toBe('mineur');
  });

  it('ignore les pages en erreur', () => {
    const crawl = makeCrawl([
      makePage({ error: 'timeout', axeViolations: [makeAxeViolation()] }),
    ]);
    expect(analyzer.analyze(crawl)).toHaveLength(0);
  });
});
