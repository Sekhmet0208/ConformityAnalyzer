import type { Page } from 'playwright';

/**
 * Heuristiques de detection/acceptation d'une banniere de consentement.
 *
 * On vise large mais sans cliquer n'importe quoi : selecteurs connus des CMP
 * majeures, puis recherche d'un bouton dont le libelle ressemble a une
 * acceptation. Permet la comparaison avant/apres consentement (PRD 3.2).
 */

/** Selecteurs specifiques de boutons "Accepter" des CMP courantes. */
const KNOWN_ACCEPT_SELECTORS = [
  '#axeptio_btn_acceptAll',
  '#didomi-notice-agree-button',
  '#onetrust-accept-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#tarteaucitronPersonalize2',
  '.tarteaucitronAllow',
  'button[aria-label="Accept all"]',
  'button[data-cky-tag="accept-button"]',
  '.cky-btn-accept',
  '.qc-cmp2-summary-buttons button[mode="primary"]',
];

/** Libelles (FR/EN) typiques d'un bouton d'acceptation. */
const ACCEPT_LABELS = [
  'tout accepter',
  'accepter tout',
  'accepter & fermer',
  'accepter et fermer',
  "j'accepte",
  'accepter',
  'autoriser tout',
  'autoriser',
  'accept all',
  'accept cookies',
  'allow all',
  'i accept',
  'i agree',
  'agree',
  'got it',
];

export interface ConsentInteractionResult {
  /** Une banniere/CMP a-t-elle ete detectee dans le DOM ? */
  detected: boolean;
  /** Un clic d'acceptation a-t-il ete realise avec succes ? */
  accepted: boolean;
  /** Comment elle a ete trouvee (selecteur ou libelle), pour le debug. */
  via: string | null;
}

export async function detectAndAccept(
  page: Page,
): Promise<ConsentInteractionResult> {
  // 1) Selecteurs connus.
  for (const sel of KNOWN_ACCEPT_SELECTORS) {
    const el = page.locator(sel).first();
    try {
      if (await el.isVisible({ timeout: 250 }).catch(() => false)) {
        await el.click({ timeout: 1500 });
        return { detected: true, accepted: true, via: sel };
      }
    } catch {
      // bouton present mais non cliquable : on continue.
    }
  }

  // 2) Recherche par libelle sur les elements cliquables.
  const candidates = page.locator(
    'button, [role="button"], a, input[type="button"], input[type="submit"]',
  );
  const count = Math.min(await candidates.count().catch(() => 0), 60);
  let detected = false;
  for (let i = 0; i < count; i++) {
    const node = candidates.nth(i);
    const raw = (await node.innerText().catch(() => '')) || '';
    const label = raw.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!label) continue;
    if (ACCEPT_LABELS.some((l) => label === l || label.includes(l))) {
      detected = true;
      try {
        if (await node.isVisible({ timeout: 250 }).catch(() => false)) {
          await node.click({ timeout: 1500 });
          return { detected: true, accepted: true, via: `label:${label}` };
        }
      } catch {
        // continue
      }
    }
  }

  return { detected, accepted: false, via: null };
}
