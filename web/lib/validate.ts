import type { Tier } from './contract';

/** Validation d'URL au niveau de l'API (http/https, hote plausible). */
export function normalizeAndValidateUrl(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;
  // Tolerance : ajoute https:// si l'utilisateur a saisi "exemple.fr".
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname;
    const isLocal = host === 'localhost' || /^127\.0\.0\.1$/.test(host);
    // Anti-abus minimal (PRD §8) : exiger un hote avec point (domaine public),
    // sauf localhost autorise en developpement.
    if (!isLocal && !host.includes('.')) return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

/** Indique au frontend si l'override dev (palier paid sans paiement) est actif. */
export function tierOverrideEnabled(): boolean {
  return (
    process.env.ALLOW_TIER_OVERRIDE === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valide un email ; renvoie l'email normalise (minuscule) ou null. */
export function validateEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

/** Valide un mot de passe (8 caracteres minimum). */
export function validatePassword(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  if (input.length < 8 || input.length > 200) return null;
  return input;
}

export type { Tier };

