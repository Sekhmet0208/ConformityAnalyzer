#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { Command } from 'commander';
import { runScan } from './scan.js';
import { redactLocked } from './report/report.js';
import { renderText } from './report/render-text.js';
import { isValidHttpUrl, hasPublicSuffix } from './crawler/url-utils.js';
import type { Tier } from './types.js';

const program = new Command();

program
  .name('compliance-scan')
  .description(
    'Coeur de scan de conformite (RGPD/cookies, accessibilite, mentions ' +
      'legales). Sortie JSON ou texte. Lot 1 — sans UI.',
  )
  .argument('<url>', 'URL racine du site a scanner')
  .option('-t, --tier <tier>', 'palier : free | paid', 'free')
  .option('-d, --max-depth <n>', 'profondeur de crawl maximale', (v) =>
    Number.parseInt(v, 10),
  )
  .option('-p, --max-pages <n>', 'nombre maximal de pages', (v) =>
    Number.parseInt(v, 10),
  )
  .option('--timeout <ms>', 'timeout par page en ms', (v) =>
    Number.parseInt(v, 10),
  )
  .option('--no-robots', 'ne pas respecter robots.txt (a vos risques)')
  .option('--json', 'sortie JSON brute')
  .option('-o, --out <file>', 'ecrire le rapport JSON dans un fichier')
  .action(async (url: string, opts) => {
    if (!isValidHttpUrl(url)) {
      console.error(`Erreur : URL invalide « ${url} » (attendu http/https).`);
      process.exitCode = 2;
      return;
    }
    // Anti-abus minimal (PRD 8) : refuser les hotes sans suffixe public, sauf
    // localhost/IP explicitement autorises pour les tests via --no-robots.
    if (!hasPublicSuffix(url) && !/localhost|127\.0\.0\.1/.test(url)) {
      console.error(
        `Erreur : « ${url} » ne ressemble pas a un domaine public valide.`,
      );
      process.exitCode = 2;
      return;
    }

    const tier = (opts.tier === 'paid' ? 'paid' : 'free') as Tier;

    try {
      const report = await runScan({
        url,
        tier,
        maxDepth: opts.maxDepth,
        maxPages: opts.maxPages,
        timeoutMs: opts.timeout,
        respectRobots: opts.robots !== false,
      });

      // En freemium, on masque concretement les details verrouilles.
      const output = tier === 'free' ? redactLocked(report) : report;

      if (opts.out) {
        await writeFile(opts.out, JSON.stringify(output, null, 2), 'utf8');
        console.error(`Rapport JSON ecrit dans ${opts.out}`);
      }

      if (opts.json) {
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log(renderText(output));
      }

      // Code de sortie non nul si des constats critiques confirmes existent
      // (pratique pour une integration CI).
      const hasCriticalConfirmed = report.findings.some(
        (f) => f.severity === 'critique' && f.status === 'confirme',
      );
      process.exitCode = hasCriticalConfirmed ? 1 : 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Echec du scan : ${message}`);
      process.exitCode = 3;
    }
  });

program.parseAsync(process.argv);
