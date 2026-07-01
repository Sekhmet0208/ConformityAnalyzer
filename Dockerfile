# syntax=docker/dockerfile:1

# =============================================================================
# Image mono-conteneur (Fly.io) : Next.js + worker de scan + redis-server local.
# Postgres est EXTERNE (Neon, via DATABASE_URL) — pas dans cette image.
#
# On part de l'image Playwright officielle pour ses DEPENDANCES SYSTEME (toutes
# les libs dont Chromium a besoin sont deja la et testees). En revanche on ne se
# fie PAS au navigateur pre-installe de l'image : les tags d'image et les builds
# de navigateurs derivent selon la version. On installe donc explicitement le
# navigateur correspondant EXACTEMENT au paquet npm `playwright` du projet, via
# `playwright install chromium` (plus bas). C'est la seule facon fiable d'eviter :
#   "browserType.launch: Executable doesn't exist at .../headless_shell"
# Ce qui tourne : le coeur de scan (worker, Chromium headless + axe-core) et le
# rendu PDF (route Next, Chromium).
# =============================================================================
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

ENV NODE_ENV=production
# Navigateurs installes dans un chemin stable, embarque dans l'image.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Redis (file BullMQ locale, lance par scripts/start-container.mjs).
RUN apt-get update \
  && apt-get install -y --no-install-recommends redis-server \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Dependances racine (coeur de scan + worker + tsx) ----------------------
# `--include=dev` est REQUIS malgre NODE_ENV=production : le worker s'execute via
# `tsx` (devDependency) et n'est jamais compile en amont. Sans ce flag, npm ci
# saute les devDependencies et le worker ne demarre pas.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# --- Navigateur : build EXACT correspondant a la version de `playwright` -----
# Telecharge le Chromium (et son headless_shell) attendu par le paquet npm
# installe ci-dessus, dans PLAYWRIGHT_BROWSERS_PATH. Ecrase/complete ce que
# l'image de base fournissait. `--with-deps` complete les libs systeme manquantes.
RUN npx playwright install --with-deps chromium

# --- Dependances de l'app web -----------------------------------------------
# Idem : `next build` a besoin de `typescript` (devDependency). Sous
# NODE_ENV=production, npm ci l'omettrait sans `--include=dev`.
COPY web/package.json web/package-lock.json ./web/
RUN npm ci --prefix web --include=dev

# --- Code source -------------------------------------------------------------
COPY . .

# --- Build de production de Next.js -----------------------------------------
RUN npm run build --prefix web

EXPOSE 3000

# L'orchestrateur lance redis-server + worker + next start, cote a cote.
CMD ["node", "scripts/start-container.mjs"]
