import { describe, expect, it } from 'vitest';
import {
  matchConsentManagerByUrl,
  matchTrackerByCookie,
  matchTrackerByUrl,
} from '../src/data/tracker-db.js';

describe('tracker-db', () => {
  it('identifie Google Analytics via le loader gtag/js', () => {
    // gtag/js est le loader de Google Analytics (GA4) -> google-analytics.
    const t = matchTrackerByUrl(
      'https://www.googletagmanager.com/gtag/js?id=G-1',
    );
    expect(t?.id).toBe('google-analytics');
  });

  it('identifie Google Tag Manager via gtm.js', () => {
    const t = matchTrackerByUrl('https://www.googletagmanager.com/gtm.js?id=GTM-1');
    expect(t?.id).toBe('google-tag-manager');
  });

  it('identifie un traceur par domaine', () => {
    const t = matchTrackerByUrl('https://connect.facebook.net/en_US/fbevents.js');
    expect(t?.id).toBe('meta-pixel');
  });

  it('identifie un traceur par nom de cookie (prefixe)', () => {
    expect(matchTrackerByCookie('_ga')?.id).toBe('google-analytics');
    expect(matchTrackerByCookie('_ga_ABC123')?.id).toBe('google-analytics');
    expect(matchTrackerByCookie('_fbp')?.id).toBe('meta-pixel');
  });

  it('renvoie null pour un cookie inconnu', () => {
    expect(matchTrackerByCookie('mon_cookie_maison')).toBeNull();
  });

  it('Stripe est un traceur fonctionnel (sans consentement requis)', () => {
    const t = matchTrackerByUrl('https://js.stripe.com/v3/');
    expect(t?.id).toBe('stripe');
    expect(t?.requiresConsent).toBe(false);
  });

  it('detecte les gestionnaires de consentement connus', () => {
    expect(matchConsentManagerByUrl('https://static.axept.io/sdk.js')?.id).toBe(
      'axeptio',
    );
    expect(
      matchConsentManagerByUrl('https://cdn.cookielaw.org/scripttemplates/otSDKStub.js')
        ?.id,
    ).toBe('onetrust');
  });
});
