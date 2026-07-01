import 'server-only';
import { chromium } from 'playwright';

/**
 * Rendu HTML -> PDF via Chromium (Playwright). Chromium est deja utilise par le
 * worker de scan et installe via `npm run browsers`. Aucun service externe, zero
 * cout : c'est le meme moteur qui imprime le document.
 *
 * En cas d'indisponibilite de Chromium, l'appelant retombe sur l'export HTML.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
