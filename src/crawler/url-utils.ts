import { getDomain, getPublicSuffix } from 'tldts';

/** Normalise une URL : supprime le fragment, trie/retire rien, garde le path. */
export function normalizeUrl(input: string, base?: string): string | null {
  try {
    const u = base ? new URL(input, base) : new URL(input);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    // Retire un slash final superflu (sauf racine) pour limiter les doublons.
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return null;
  }
}

/** Renvoie le domaine enregistrable (eTLD+1) d'une URL, ou null. */
export function registrableDomain(url: string): string | null {
  return getDomain(url) ?? null;
}

/**
 * Deux URLs sont-elles sur le meme site (meme domaine enregistrable) ?
 * On reste sur le meme eTLD+1 pour autoriser les sous-domaines (www, blog...).
 */
export function isSameSite(a: string, b: string): boolean {
  const da = registrableDomain(a);
  const db = registrableDomain(b);
  if (da && db) return da === db;
  // Repli sur le hostname si tldts ne reconnait pas (ex: localhost, IP).
  try {
    return new URL(a).hostname === new URL(b).hostname;
  } catch {
    return false;
  }
}

/** Indique si un hote est tiers par rapport au site racine (pour les traceurs). */
export function isThirdParty(resourceUrl: string, rootUrl: string): boolean {
  try {
    const rd = registrableDomain(resourceUrl);
    const rootRd = registrableDomain(rootUrl);
    if (rd && rootRd) return rd !== rootRd;
    return new URL(resourceUrl).hostname !== new URL(rootUrl).hostname;
  } catch {
    return false;
  }
}

/** Hostname depourvu de "www." pour comparaisons lisibles. */
export function bareHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function isValidHttpUrl(input: string): boolean {
  return normalizeUrl(input) !== null;
}

/** Verifie qu'une chaine ressemble a un domaine public (sert a l'anti-abus). */
export function hasPublicSuffix(url: string): boolean {
  return getPublicSuffix(url) !== null;
}
