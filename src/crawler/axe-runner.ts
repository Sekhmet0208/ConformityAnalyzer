import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright';
import { AXE_WCAG_TAGS } from '../constants.js';
import type { AxeViolation } from './types.js';

/**
 * Lance axe-core sur une page rendue, restreint aux regles WCAG A & AA
 * automatisables (PRD 3.4). Renvoie une forme reduite et stable des violations.
 *
 * Tolerant aux pannes : en cas d'echec d'injection axe, renvoie [] plutot que
 * de casser le scan (PRD 8 : ne pas eroder la confiance, rester robuste).
 */
export async function runAxe(page: Page): Promise<AxeViolation[]> {
  try {
    const results = await new AxeBuilder({ page })
      .withTags(AXE_WCAG_TAGS)
      .analyze();
    return results.violations.map((v) => ({
      id: v.id,
      impact: (v.impact as AxeViolation['impact']) ?? null,
      help: v.help,
      helpUrl: v.helpUrl,
      tags: v.tags,
      nodes: v.nodes.slice(0, 10).map((n) => ({
        target: n.target.map((t) => String(t)),
        html: n.html.slice(0, 300),
        failureSummary: n.failureSummary ?? null,
      })),
    }));
  } catch {
    return [];
  }
}
