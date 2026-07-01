#!/usr/bin/env node
/**
 * Orchestrateur de developpement : demarre en une commande les 3 process de
 * l'application (Redis, worker de scan, site Next.js) et les arrete proprement
 * avec Ctrl+C.
 *
 * Usage : `npm run dev:all`  (a la racine du repo)
 *
 * Redis : s'il tourne deja, on le reutilise ; sinon on tente `redis-server`
 * (installe via Homebrew/apt), puis `docker compose up redis` en dernier recours.
 * Aucune dependance externe : uniquement des modules Node natifs.
 */
import { spawn, spawnSync } from 'node:child_process';
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

const COLORS = {
  redis: '\x1b[35m', // magenta
  worker: '\x1b[36m', // cyan
  web: '\x1b[32m', // vert
  sys: '\x1b[33m', // jaune
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const children = [];
let shuttingDown = false;

function log(name, color, text) {
  const prefix = `${color}[${name}]${COLORS.reset}`;
  for (const line of String(text).split(/\r?\n/)) {
    if (line.trim().length > 0) process.stdout.write(`${prefix} ${line}\n`);
  }
}

function sys(text) {
  log('dev:all', COLORS.sys, text);
}

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

function hasCommand(cmd) {
  const res = spawnSync('command', ['-v', cmd], { shell: true, stdio: 'ignore' });
  return res.status === 0;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** Demarre un process enfant, prefixe sa sortie et gere son arret. */
function start(name, color, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => log(name, color, d));
  child.stderr.on('data', (d) => log(name, color, d));
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    sys(
      `Le process "${name}" s'est arrete (${signal ?? `code ${code}`}). Arret de la stack.`,
    );
    shutdown(1);
  });
  children.push({ name, child });
  return child;
}

/** Assure la disponibilite de Redis. Renvoie true si demarre par nos soins. */
async function ensureRedis() {
  if (await isRedisUp()) {
    sys(`Redis deja actif sur ${REDIS_HOST}:${REDIS_PORT} — reutilise.`);
    return false;
  }

  if (hasCommand('redis-server')) {
    sys('Demarrage de redis-server…');
    start('redis', COLORS.redis, 'redis-server', [
      '--port',
      String(REDIS_PORT),
      '--save',
      '',
      '--appendonly',
      'no',
    ]);
  } else if (hasCommand('docker')) {
    sys('redis-server absent — tentative via `docker compose up redis`…');
    start('redis', COLORS.redis, 'docker', ['compose', 'up', 'redis'], ROOT);
  } else {
    sys(
      'ERREUR : ni redis-server ni docker disponibles. Installez Redis ' +
        '(`brew install redis`) ou demarrez Docker, puis relancez.',
    );
    process.exit(1);
  }

  // Attente que Redis accepte les connexions (max ~9 s).
  for (let i = 0; i < 30; i++) {
    if (await isRedisUp()) {
      sys('Redis pret.');
      return true;
    }
    await delay(300);
  }
  sys('ERREUR : Redis n\'a pas demarre a temps.');
  shutdown(1);
  return false;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  sys('Arret en cours… (Ctrl+C)');
  for (const { child } of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  // Laisse le temps aux enfants de se fermer, puis quitte.
  setTimeout(() => process.exit(code), 1200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  sys('Demarrage de la stack (Redis + worker + site)…');
  await ensureRedis();

  start('worker', COLORS.worker, 'npm', ['run', 'worker'], ROOT);
  start('web', COLORS.web, 'npm', ['run', 'dev'], WEB);

  sys('');
  sys('Tout est lance. Ouvrez http://localhost:3000');
  sys('Arret : Ctrl+C');
}

main().catch((err) => {
  sys(`Echec du demarrage : ${err?.message ?? err}`);
  shutdown(1);
});
