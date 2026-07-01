import type { Page } from 'playwright';

/**
 * Donnees extraites dans le contexte du navigateur. Sans typage Playwright cote
 * page : on reconstruit les types cote Node apres `evaluate`.
 */
export interface InPageData {
  title: string;
  htmlLang: string | null;
  html: string;
  visibleText: string;
  links: { href: string; text: string; rel: string }[];
  scripts: { src: string | null; inline: boolean }[];
  forms: {
    action: string;
    method: string;
    fields: { name: string; type: string; label: string | null }[];
    nearbyText: string;
  }[];
}

/**
 * Execute l'extraction DOM dans la page. Tout le code de la fonction passee a
 * `evaluate` s'execute dans le navigateur ; il ne doit donc dependre d'aucun
 * symbole Node.
 */
export async function extractInPage(page: Page): Promise<InPageData> {
  return page.evaluate(() => {
    // tsx/esbuild peut injecter un helper `__name` (option keepNames) dans le
    // code envoye a evaluate ; il n'existe pas dans le contexte du navigateur.
    // On le neutralise localement pour eviter "ReferenceError: __name".
    const g = globalThis as unknown as { __name?: (f: unknown) => unknown };
    if (typeof g.__name !== 'function') g.__name = (f) => f;

    const text = (el: Element | null): string =>
      (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

    const labelFor = (input: Element): string | null => {
      const id = input.getAttribute('id');
      if (id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lbl) return text(lbl);
      }
      const parentLabel = input.closest('label');
      if (parentLabel) return text(parentLabel);
      const aria = input.getAttribute('aria-label');
      if (aria) return aria;
      return null;
    };

    const links = Array.from(document.querySelectorAll('a[href]')).map((a) => ({
      href: (a as HTMLAnchorElement).href,
      text: text(a),
      rel: a.getAttribute('rel') ?? '',
    }));

    const scripts = Array.from(document.querySelectorAll('script')).map((s) => {
      const src = s.getAttribute('src');
      return { src: src ?? null, inline: !src };
    });

    const forms = Array.from(document.querySelectorAll('form')).map((f) => {
      const fields = Array.from(
        f.querySelectorAll('input, textarea, select'),
      )
        .filter((el) => {
          const type = (el.getAttribute('type') ?? '').toLowerCase();
          return type !== 'submit' && type !== 'button' && type !== 'hidden';
        })
        .map((el) => ({
          name:
            el.getAttribute('name') ?? el.getAttribute('id') ?? '',
          type: (el.getAttribute('type') ?? el.tagName).toLowerCase(),
          label: labelFor(el),
        }));
      return {
        action: (f as HTMLFormElement).action ?? '',
        method: (f.getAttribute('method') ?? 'get').toLowerCase(),
        fields,
        nearbyText: text(f).slice(0, 600),
      };
    });

    return {
      title: document.title ?? '',
      htmlLang: document.documentElement.getAttribute('lang'),
      html: document.documentElement.outerHTML,
      visibleText: (document.body?.innerText ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 20000),
      links,
      scripts,
      forms,
    };
  });
}
