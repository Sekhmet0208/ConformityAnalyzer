import type { LoadedScript } from './types.js';

/**
 * Detection best-effort du CMS a partir du HTML rendu et des scripts charges
 * (PRD 3.1 : "Detection de la stack si possible"). Heuristique : on ne renvoie
 * un nom que si un marqueur clair est present.
 */
export function detectCms(html: string, scripts: LoadedScript[]): string | null {
  const h = html.toLowerCase();
  const srcs = scripts.map((s) => (s.src ?? '').toLowerCase());
  const inSrc = (needle: string): boolean => srcs.some((s) => s.includes(needle));

  if (h.includes('/wp-content/') || h.includes('/wp-includes/') || inSrc('wp-content')) {
    return 'WordPress';
  }
  if (h.includes('cdn.shopify.com') || h.includes('shopify') || inSrc('shopify')) {
    return 'Shopify';
  }
  if (h.includes('content="wix.com') || h.includes('static.wixstatic.com') || inSrc('wix')) {
    return 'Wix';
  }
  if (h.includes('squarespace') || inSrc('squarespace')) {
    return 'Squarespace';
  }
  if (h.includes('data-drupal') || h.includes('/sites/default/files/') || inSrc('drupal')) {
    return 'Drupal';
  }
  if (h.includes('/media/jui/') || h.includes('joomla') || inSrc('joomla')) {
    return 'Joomla';
  }
  if (h.includes('__next') || inSrc('/_next/')) {
    return 'Next.js';
  }
  if (h.includes('webflow') || inSrc('webflow')) {
    return 'Webflow';
  }
  if (h.includes('prestashop') || inSrc('prestashop')) {
    return 'PrestaShop';
  }
  return null;
}
