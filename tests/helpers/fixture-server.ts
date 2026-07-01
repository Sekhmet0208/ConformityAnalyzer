import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import type { AddressInfo } from 'node:net';

const here = dirname(fileURLToPath(import.meta.url));

export interface FixtureServer {
  origin: string;
  close: () => Promise<void>;
}

/**
 * Sert un dossier de fixtures sur un port aleatoire. Mappe les URL "propres"
 * (ex: /mentions-legales) vers le fichier .html correspondant, et / vers
 * index.html. Sert un robots.txt permissif par defaut si present.
 */
export async function serveFixture(
  folder: 'compliant' | 'non-compliant',
  options: { robots?: string } = {},
): Promise<FixtureServer> {
  // Ce fichier est dans tests/helpers/ ; les fixtures sont dans tests/fixtures/.
  const root = join(here, '..', 'fixtures', folder);

  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let pathname = decodeURIComponent(url.pathname);

      if (pathname === '/robots.txt') {
        res.writeHead(options.robots ? 200 : 404, {
          'content-type': 'text/plain',
        });
        res.end(options.robots ?? 'Not found');
        return;
      }

      if (pathname === '/') pathname = '/index.html';
      // URL propre -> .html
      if (!pathname.includes('.')) pathname = `${pathname}.html`;

      // Securite : empeche la traversee de repertoire.
      const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
      const filePath = join(root, safe);
      if (!filePath.startsWith(root)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      const data = await readFile(filePath).catch(() => null);
      if (data === null) {
        res.writeHead(404, { 'content-type': 'text/html' });
        res.end('<!doctype html><html><body>404</body></html>');
        return;
      }
      const ext = filePath.split('.').pop();
      const type =
        ext === 'html'
          ? 'text/html; charset=utf-8'
          : ext === 'png'
            ? 'image/png'
            : 'application/octet-stream';
      res.writeHead(200, { 'content-type': type });
      res.end(data);
    } catch {
      res.writeHead(500);
      res.end('error');
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;

  return {
    origin,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
