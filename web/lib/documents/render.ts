import type { DocumentContext } from './types';

/**
 * Avertissement legal reutilise dans TOUS les documents generes (PRD §8/§9 :
 * disclaimer systematique, l'outil ne garantit pas la conformite).
 */
export const DOC_DISCLAIMER =
  "Ce document a été généré automatiquement à partir d'un modèle et des " +
  "informations que vous avez fournies. Il constitue une aide à la mise en " +
  "conformité et non un conseil juridique. Vérifiez et adaptez son contenu à " +
  "votre situation ; en cas de doute, consultez un professionnel du droit.";

/** Echappement HTML pour eviter toute injection dans les documents. */
export function esc(value: unknown): string {
  const s = value === undefined || value === null ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PLACEHOLDER = '<span class="todo">[À COMPLÉTER]</span>';

/** Renvoie la valeur echappee, ou un marqueur "[À COMPLÉTER]" si absente. */
export function slot(value: string | undefined | null): string {
  const v = (value ?? '').trim();
  return v ? esc(v) : PLACEHOLDER;
}

/** Valeur echappee, ou chaine vide si absente (pour les fragments optionnels). */
export function opt(value: string | undefined | null): string {
  const v = (value ?? '').trim();
  return v ? esc(v) : '';
}

export function today(): string {
  return new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Enveloppe un corps HTML dans un document autonome et imprimable (styles
 * inline, compatible export PDF). `printable` ajoute des marges d'impression.
 */
export function wrapDocument(
  title: string,
  bodyHtml: string,
  context: DocumentContext,
): string {
  const site = opt(context.siteName) || opt(context.siteUrl) || 'votre site';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  :root { --ink:#1a2233; --muted:#5b6b86; --line:#e3e9f2; --accent:#0f9d76; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: var(--ink); line-height: 1.65; max-width: 820px;
    margin: 0 auto; padding: 48px 40px; background: #fff;
  }
  h1 { font-size: 1.9rem; margin: 0 0 4px; }
  h2 { font-size: 1.25rem; margin: 28px 0 8px; padding-bottom: 4px;
       border-bottom: 1px solid var(--line); }
  h3 { font-size: 1.05rem; margin: 18px 0 6px; }
  p, li { font-size: 0.98rem; }
  ul { padding-left: 22px; }
  .doc-meta { color: var(--muted); font-size: 0.86rem; margin-bottom: 24px; }
  .doc-lead { color: var(--muted); font-style: italic; }
  .todo { background: #fff3cd; color: #8a6100; padding: 1px 6px;
          border-radius: 4px; font-family: system-ui, sans-serif;
          font-size: 0.82rem; font-style: normal; }
  .disclaimer {
    margin-top: 40px; padding: 16px 18px; border-left: 3px solid var(--accent);
    background: #f4faf7; color: var(--muted); font-size: 0.85rem;
    font-family: system-ui, sans-serif;
  }
  code, pre { font-family: 'SFMono-Regular', Consolas, monospace; }
  pre { background: #0e1b30; color: #e6ecf4; padding: 16px; border-radius: 8px;
        overflow-x: auto; font-size: 0.82rem; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { text-align: left; padding: 8px 10px; border: 1px solid var(--line);
           font-size: 0.9rem; }
  th { background: #f4f7fb; }
  @media print { body { padding: 0; } .disclaimer { break-inside: avoid; } }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<p class="doc-meta">${esc(site)} · Document généré le ${today()}</p>
${bodyHtml}
<div class="disclaimer">${esc(DOC_DISCLAIMER)}</div>
</body>
</html>`;
}
