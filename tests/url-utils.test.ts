import { describe, expect, it } from 'vitest';
import {
  bareHost,
  isSameSite,
  isThirdParty,
  isValidHttpUrl,
  normalizeUrl,
  registrableDomain,
} from '../src/crawler/url-utils.js';

describe('url-utils', () => {
  it('normalise et retire le fragment + slash final', () => {
    expect(normalizeUrl('https://ex.com/a/#section')).toBe('https://ex.com/a');
    expect(normalizeUrl('https://ex.com/')).toBe('https://ex.com/');
  });

  it('resout les URLs relatives via base', () => {
    expect(normalizeUrl('/contact', 'https://ex.com/a/b')).toBe(
      'https://ex.com/contact',
    );
  });

  it('rejette les schemes non http(s)', () => {
    expect(normalizeUrl('mailto:a@b.com')).toBeNull();
    expect(normalizeUrl('javascript:void(0)')).toBeNull();
    expect(isValidHttpUrl('ftp://x')).toBe(false);
  });

  it('reconnait le meme site (sous-domaines inclus)', () => {
    expect(isSameSite('https://www.ex.com/a', 'https://blog.ex.com/b')).toBe(
      true,
    );
    expect(isSameSite('https://ex.com', 'https://autre.com')).toBe(false);
  });

  it('detecte le tiers-partie pour les traceurs', () => {
    expect(
      isThirdParty('https://google-analytics.com/x', 'https://ex.com'),
    ).toBe(true);
    expect(isThirdParty('https://cdn.ex.com/x', 'https://ex.com')).toBe(false);
  });

  it('extrait le domaine enregistrable et l hote nu', () => {
    expect(registrableDomain('https://www.ex.co.uk/a')).toBe('ex.co.uk');
    expect(bareHost('https://www.ex.com/a')).toBe('ex.com');
  });
});
