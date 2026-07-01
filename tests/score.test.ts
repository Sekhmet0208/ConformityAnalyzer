import { describe, expect, it } from 'vitest';
import {
  computeScore,
  gradeFromScore,
  prioritize,
  summarize,
} from '../src/report/score.js';
import { makeFinding } from '../src/analyzers/analyzer.js';
import type { Finding } from '../src/types.js';

function f(over: Partial<Finding>): Finding {
  return makeFinding({
    id: over.id ?? 'x',
    category: over.category ?? 'cookies',
    severity: over.severity ?? 'mineur',
    title: over.title ?? 't',
    evidence: over.evidence ?? {},
    recommendation: over.recommendation ?? 'r',
    status: over.status ?? 'confirme',
    locked: over.locked ?? false,
  });
}

describe('score', () => {
  it('renvoie 100 sans findings', () => {
    expect(computeScore([])).toBe(100);
  });

  it('penalise selon la severite (confirme)', () => {
    expect(computeScore([f({ severity: 'critique' })])).toBe(85);
    expect(computeScore([f({ severity: 'important' })])).toBe(93);
    expect(computeScore([f({ severity: 'mineur' })])).toBe(98);
  });

  it('penalise moins un finding a_verifier', () => {
    const confirmed = computeScore([f({ severity: 'critique', status: 'confirme' })]);
    const toVerify = computeScore([
      f({ severity: 'critique', status: 'a_verifier' }),
    ]);
    expect(toVerify).toBeGreaterThan(confirmed);
  });

  it('borne le score a 0', () => {
    const many = Array.from({ length: 20 }, () => f({ severity: 'critique' }));
    expect(computeScore(many)).toBe(0);
  });

  it('derive une note A-E', () => {
    expect(gradeFromScore(95)).toBe('A');
    expect(gradeFromScore(80)).toBe('B');
    expect(gradeFromScore(60)).toBe('C');
    expect(gradeFromScore(40)).toBe('D');
    expect(gradeFromScore(10)).toBe('E');
  });

  it('resume par severite, categorie et statut', () => {
    const s = summarize([
      f({ severity: 'critique', category: 'cookies', status: 'confirme' }),
      f({ severity: 'mineur', category: 'accessibilite', status: 'a_verifier' }),
    ]);
    expect(s.total).toBe(2);
    expect(s.confirmed).toBe(1);
    expect(s.to_verify).toBe(1);
    expect(s.by_severity.critique).toBe(1);
    expect(s.by_category.accessibilite).toBe(1);
  });

  it('priorise critique avant mineur, confirme avant a_verifier', () => {
    const ordered = prioritize([
      f({ id: 'b', severity: 'mineur' }),
      f({ id: 'a', severity: 'critique' }),
      f({ id: 'c', severity: 'critique', status: 'a_verifier' }),
    ]);
    expect(ordered.map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });
});
