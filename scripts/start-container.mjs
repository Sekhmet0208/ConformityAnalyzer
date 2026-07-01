#!/usr/bin/env node
/**
 * Orchestrateur de PRODUCTION mono-conteneur (Fly.io).
 *
 * Lance cote a cote, dans un seul conteneur, les 3 process de l'application :
 *   - redis-server (file BullMQ locale, ephemere — voir note plus bas)
 *   - worker de scan  : `npm run worker` (racine)  = tsx src/server/worker.ts
 *   - site Next.js    : `npm start` (dossier web)   = next start -p 3000
 *
 * S'inspire de scripts/dev-all.mjs, mais adapte au conteneur :
 *   - Redis est TOUJOURS present dans l'image (installe via apt) : on le demarre
 *     nous-memes, sans fallback Docker.
 *   - On lance les builds de production (next start), pas `next dev`.
 *   - Si UN process meurt, on arrete tout le conteneur (exit != 0) pour que Fly
 *     redemarre la machine proprement (pas d'etat zombie a moitie mort).
 *
 * Note sur Redis ephemere : Redis ne porte QUE la file de jobs (jobs de scan
 * re-emettables). Les sessions, comptes, scans et documents sont en Postgres
 * (Neon, DATABASE_URL). La perte de Redis a un restart ne perd donc que des
 * jobs en cours, ré-émettables par l'utilisateur. Pour sortir vers Upstash plus
 * tard : il suffit de changer REDIS_URL et de ne plus demarrer redis-server ici.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web');

const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const { hostname: REDIS_HOST, port: REDIS_PORT } = (() => {
  try {
    const u = new URL(REDIS_URL);
    return { hostname: u.hostname || '127.0.0.1', port: Number(u.port) || 6379 };
  } catch {
    return { hostname: '127.0.0.1', port: 6379 };
  }
})();

const children = [];
let shuttingDown = false;

function log(name, text) {
  for (const line of String(text).split(/\r?\n/)) {
    if (line.trim().length > 0) process.stdout.write(`[${name}] ${line}\n`);
  }
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** Le port Redis accepte-t-il une connexion TCP ? */
function isRedisUp() {
  return new Promise((resolve) => {
    const sock = net.connect({ host: REDIS_HOST, port: REDIS_PORT });
    sock.setTimeout(800);
    sock.once('connect', () => {
      sock.end();
      resolve(true);
    });
    sock.once('error', () => resolve(false));
    sock.once('timeout', () => {
      sock.destroy();
      resolve(false);
    });
  });
}

/** Demarre un process enfant, prefixe sa sortie et gere son arret. */
function start(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => log(name, d));
  child.stderr.on('data', (d) => log(name, d));
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    log('start', `process "${name}" arrete (${signal ?? `code ${code}`}). Arret du conteneur.`);
    shutdown(1);
  });
  children.push({ name, child });
  return child;
}

async function ensureRedis() {
  if (await isRedisUp()) {
    log('start', `Redis deja actif sur ${REDIS_HOST}:${REDIS_PORT}.`);
    return;
  }
  log('start', 'Demarrage de redis-server…');
  // --save "" + --appendonly no : Redis purement en memoire (ephemere assume).
  start('redis', 'redis-server', [
    '--port',
    String(REDIS_PORT),
    '--save',
    '',
    '--appendonly',
    'no',
  ]);
  for (let i = 0; i < 30; i++) {
    if (await isRedisUp()) {
      log('start', 'Redis pret.');
      return;
    }
    await delay(300);
  }
  log('start', 'ERREUR : Redis n\'a pas demarre a temps.');
  shutdown(1);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('start', 'Arret en cours…');
  for (const { child } of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 2000);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  log('start', 'Demarrage de la stack conteneur (Redis + worker + web)…');
  await ensureRedis();

  start('worker', 'npm', ['run', 'worker'], ROOT);
  start('web', 'npm', ['start'], WEB);

  log('start', 'Stack lancee. Web sur le port 3000.');
}

main().catch((err) => {
  log('start', `Echec du demarrage : ${err?.message ?? err}`);
  shutdown(1);
});
