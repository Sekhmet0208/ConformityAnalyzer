# Compliance Scan — Lots 1, 2, 3 & 4

Cœur de scan de conformité pour PME (RGPD/cookies, accessibilité, mentions
légales) **et** application web freemium avec comptes, paiement et génération de
documents légaux.

- **Lot 1** (`src/`) : crawler headless + analyseurs + findings normalisés,
  testable en **CLI**, sans UI.
- **Lot 2** (`web/` + `src/server/`) : landing + formulaire URL + écran de
  progression + viewer de rapport, scan **freemium** de bout en bout. File de
  jobs Redis/BullMQ, worker Playwright en process séparé (archi cible du PRD).
- **Lot 3** (`web/lib/`, `web/app/api/auth|billing|stripe`) : **comptes**
  (auth email/mot de passe, sessions), **Stripe** (abonnement + webhook, avec
  simulation dev), **paywall** appliqué à la lecture et **déverrouillage** des
  findings du même scan après paiement.
- **Lot 4** (`web/lib/documents/`, `web/app/documents`) : **génération de
  documents légaux** (mentions légales, politique de confidentialité,
  déclaration d'accessibilité, bannière cookies) via **templates à trous**
  déterministes (aucune API, gratuit), pré-remplis depuis le scan, avec
  **export HTML et PDF**. Réservée aux comptes abonnés.

> ⚠️ **Avertissement** : cet outil fournit une aide automatisée à la mise en
> conformité et des documents-types. Il **ne constitue pas un conseil juridique**
> et **ne garantit pas** la conformité. Seuls ~30–40 % des critères WCAG sont
> vérifiables automatiquement. Voir [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md).

## Architecture

```
Navigateur ──POST /api/scans──▶ API Next.js ──enqueue──▶ Redis (BullMQ)
     ▲                              │  ▲                     │
     │                     SQLite (comptes,      consume ◀───┘
     │                    scans, abonnements)         │
     └──GET /api/scans/:id (polling)──┘        Worker Playwright ──▶ coeur (src/)
```

Le **worker** (Playwright) tourne dans un process séparé, jamais bundlé dans
Next.js. Web et worker ne communiquent **que** par Redis. Le cœur de scan
(`src/`) reste inchangé et conserve ses 50 tests.

**Paywall (Lot 3).** Le worker stocke le rapport **complet** (non caviardé). Le
masquage des détails est appliqué **à la lecture** selon les droits du visiteur
(abonnement actif, propriété du scan, ou déverrouillage dev). Conséquence :
après paiement, le **même** scan se débloque instantanément, sans re-scanner
(PRD §6).

## Ce que fait l'ensemble

- **Crawler** Playwright (Chromium headless) : respecte `robots.txt` et
  `nofollow`, profondeur/pages limitées selon le palier, user-agent honnête
  `ComplianceBot/1.0`, rendu JS, capture réseau/cookies/scripts **avant et
  après** consentement simulé, détection de la stack (CMS/CMP/traceurs).
- **Analyseur RGPD/cookies** : cookies & traceurs déposés avant consentement,
  absence de CMP, symétrie accepter/refuser, lien politique de confidentialité,
  formulaires sans mention de finalité.
- **Analyseur accessibilité** : audit `axe-core` restreint à WCAG 2.1 **A & AA**
  automatisables (contraste, `alt`, langue de page, structure de titres…).
- **Analyseur mentions légales** (droit français) : présence d'une page dédiée
  accessible partout + checklist des éléments obligatoires (éditeur, hébergeur,
  directeur de publication, contact, SIRET/RCS).
- **Rapport normalisé** : findings au format §5.2 du PRD, score `/100`, note
  `A–E`, priorisation, **verrouillage freemium** des détails, disclaimer.
- **Frontend** : landing marketing, formulaire URL, écran de progression
  (polling), viewer de rapport avec jauge de score, filtres par catégorie, et
  bannière de déverrouillage en gratuit.
- **Comptes & paiement** : inscription/connexion, tableau de bord listant ses
  scans, abonnement Stripe (mode test) ou simulation dev, déverrouillage des
  rapports. Les scans lancés anonymement sont rattachés au compte à
  l'inscription.
- **Génération de documents** : à partir d'un scan, produit mentions légales,
  politique de confidentialité, déclaration d'accessibilité et bannière cookies
  via des **templates à trous** (déterministes, sans API, gratuits), avec export
  **HTML et PDF** (rendu Chromium). Chaque document porte le disclaimer légal ;
  les champs manquants sont marqués « [À COMPLÉTER] » plutôt qu'inventés (PRD §9).


## Prérequis

- Node.js ≥ 18
- Chromium pour Playwright : `npm run browsers`

## Installation

```bash
npm install
npm run browsers   # télécharge Chromium (playwright install chromium)
```

## Utilisation en CLI

```bash
# Scan gratuit (détails verrouillés), rapport texte
npm run scan -- https://exemple.fr

# Palier payant (détails déverrouillés)
npm run scan -- https://exemple.fr --tier paid

# Sortie JSON + écriture fichier
npm run scan -- https://exemple.fr --tier paid --json --out report.json

# Options
#   -t, --tier <free|paid>   palier (défaut: free)
#   -d, --max-depth <n>      profondeur de crawl (défaut: 2)
#   -p, --max-pages <n>      pages max (free: 5, paid: 50)
#       --timeout <ms>       timeout par page (défaut: 15000)
#       --no-robots          ignorer robots.txt (à vos risques)
#       --json               sortie JSON brute
#   -o, --out <fichier>      écrire le JSON dans un fichier
```

Code de sortie : `1` si au moins un constat **critique confirmé** existe
(pratique en CI), `0` sinon, `2` URL invalide, `3` échec de scan.

## Lancer l'application web

L'app web nécessite **Redis** (file de jobs) et **trois process** : Redis, le
worker de scan, et Next.js.

### Option A — tout en une commande (recommandé)

```bash
# Une seule fois : dépendances + navigateur + config
npm install && npm run browsers
cd web && npm install && cp .env.example .env.local && cd ..

# À chaque fois : démarre Redis + worker + site, arrêt avec Ctrl+C
npm run dev:all
```

`dev:all` démarre Redis s'il n'est pas déjà lancé (via `redis-server`, ou
`docker compose` en secours), puis le worker et le site, avec une sortie
préfixée `[redis] [worker] [web]`. Ctrl+C arrête proprement l'ensemble.

### Option B — trois terminaux (contrôle fin)

```bash
# 1) Redis — au choix :
docker compose up -d redis      # via Docker
# ou : brew install redis && redis-server --daemonize yes

# 2) Worker de scan (à la racine du repo, process séparé)
npm run worker

# 3) Frontend + API (dans web/)
cd web
npm install
cp .env.example .env.local      # ALLOW_TIER_OVERRIDE=true pour tester gratuitement
npm run dev                     # http://localhost:3000
```

Puis ouvrez **http://localhost:3000**, saisissez une URL, et suivez le scan
jusqu'au rapport. Créez un compte pour conserver vos scans et débloquer les
détails.

### Comptes & paiement (Lot 3)

- **Inscription/connexion** : email + mot de passe (hachage `scrypt`, sessions
  en base + cookie httpOnly). Le tableau de bord `/account` liste vos scans.
- **Abonnement** : bouton « Passer à Essentiel ». Deux modes :
  - **Simulation dev** (par défaut, aucune clé Stripe) : l'abonnement s'active
    immédiatement — idéal pour tester le déverrouillage sans payer.
  - **Stripe réel** : renseignez `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` et
    `STRIPE_WEBHOOK_SECRET` (mode **test** recommandé, cartes `4242 4242…`).
    Le webhook `/api/stripe/webhook` synchronise l'état de l'abonnement.
- **Déverrouillage** : une fois abonné, le détail de **vos** scans (ceux
  rattachés à votre compte) se débloque, y compris ceux déjà réalisés.

### Tester gratuitement le rapport COMPLET (sans paiement)

Trois façons de voir le rapport déverrouillé sans payer :

1. **CLI** : `npm run scan -- <url> --tier paid` déverrouille tout.
2. **Abonnement simulé** : en mode dev (sans clés Stripe), le bouton
   « Passer à Essentiel » active directement l'abonnement — vous voyez alors le
   détail de vos scans.
3. **Override dev** : avec `ALLOW_TIER_OVERRIDE=true` dans `web/.env.local`, une
   case « Mode dev : rapport complet » apparaît sous le formulaire. Elle force le
   déverrouillage d'un scan anonyme. **Sans effet en production**.

> Le palier par défaut depuis le web reste **`free`** : les détails sont
> verrouillés et un CTA « Débloquer les corrections » s'affiche (modèle freemium
> du PRD §1.3). Le paywall est **appliqué à la lecture** ; le rapport complet
> n'est jamais envoyé au navigateur d'un visiteur non habilité.

## Utilisation programmatique

```ts
import { runScan } from './src/index.js';

const report = await runScan({ url: 'https://exemple.fr', tier: 'paid' });
console.log(report.score, report.findings.length);
```

## Architecture

```
src/
  types.ts              Types normalisés (Finding §5.2, ScanResult…)
  constants.ts          Disclaimer, user-agent, poids du score, limites
  scan.ts               Orchestrateur : crawl -> analyseurs -> rapport
  cli.ts                Interface en ligne de commande
  crawler/
    crawler.ts          Pilotage Playwright, BFS, before/after consentement
    robots.ts           Parseur robots.txt (Allow/Disallow, *, $, crawl-delay)
    url-utils.ts        Normalisation d'URL, même-site, tiers-partie
    page-extract.ts     Extraction DOM (liens, formulaires, scripts, texte)
    consent.ts          Détection + clic "Accepter" des CMP
    axe-runner.ts       Exécution axe-core (WCAG A/AA)
    stack-detect.ts     Détection CMS
    types.ts            Types de capture du crawl
  analyzers/
    analyzer.ts         Contrat Analyzer + makeFinding
    rgpd-cookies.ts     Analyseur RGPD/cookies
    accessibility.ts    Mapping axe -> findings normalisés
    legal-mentions.ts   Analyseur mentions légales
    legal-extract.ts    Extracteur (heuristique par défaut, LLM-ready)
  report/
    score.ts            Score, note, résumé, priorisation
    report.ts           Assemblage + verrouillage freemium
    render-text.ts      Rendu console
  server/               Lot 2 — couche file de jobs
    queue.ts            File BullMQ + options Redis (producteur)
    worker.ts           Worker Playwright (consommateur, process séparé)
  data/
    trackers.json       Base de signatures de traceurs et CMP (découplée)
    tracker-db.ts       Chargeur/matcher de signatures
tests/                  Tests unitaires + e2e (fixtures + Chromium réel)
docs/                   WCAG-COVERAGE.md, ASSUMPTIONS.md
web/                    Lots 2 & 3 — application Next.js (App Router)
  app/
    page.tsx            Landing + formulaire URL
    scan/[id]/page.tsx  Page de scan (progression puis rapport)
    login|signup/       Pages d'authentification
    account/            Tableau de bord (scans + abonnement)
    billing/success/    Confirmation d'abonnement
    api/scans/          POST (enqueue + persist), GET :id (poll + caviardage)
    api/auth/           signup, login, logout
    api/billing/checkout  Démarrage d'abonnement (Stripe ou simulation dev)
    api/stripe/webhook  Réception des événements Stripe
    globals.css         Design system
  components/           ScanForm, ScanView, ReportView, AuthForm,
                        UnlockButton, LogoutButton
  lib/                  contract.ts (types §5.2), queue.ts, validate.ts,
                        db.ts (SQLite), auth.ts (scrypt+sessions),
                        entitlement.ts (paywall lecture), billing.ts (Stripe),
                        scans-store.ts, session-cookies.ts
```

## Tests

```bash
npm test               # cœur de scan : unitaires + e2e (lance un vrai Chromium)
npm run typecheck      # vérification TypeScript du cœur
cd web && npm run build # build + typecheck de l'app web
```

Les fixtures HTML représentatives (site conforme / non conforme) sont dans
`tests/fixtures/`. Un serveur de fixtures local (`tests/helpers/fixture-server.ts`)
les sert pour les tests e2e.

## Déploiement — Fly.io mono-conteneur + Postgres Neon

Cible de démarrage : **un seul conteneur Fly.io** qui fait tourner côte à côte
Next.js + le worker de scan + un `redis-server` local, avec une base **Postgres
Neon externe**. Conçu pour évoluer sans réécriture (voir « Migration prod »).

**Architecture déployée**

| Composant        | Où                                   | Piloté par        |
| ---------------- | ------------------------------------ | ----------------- |
| Next.js (web)    | conteneur Fly, port 3000             | `next start`      |
| Worker de scan   | conteneur Fly (même image)           | `npm run worker`  |
| Redis (file)     | conteneur Fly, **local & éphémère**  | `redis-server`    |
| Postgres         | **Neon** (externe)                   | `DATABASE_URL`    |

Les trois process du conteneur sont lancés par
[`scripts/start-container.mjs`](scripts/start-container.mjs) (inspiré de
`dev-all.mjs`). Redis n'héberge **que la file de jobs** (jobs ré-émettables) —
comptes, sessions, scans et documents sont en Postgres. Sa perte à un redémarrage
ne perd que des jobs en cours, relançables par l'utilisateur.

**Base : SQLite → Postgres.** La couche `web/lib/db.ts` utilise désormais `pg`
(asynchrone) piloté par `DATABASE_URL`. Le schéma est créé automatiquement au
premier accès (migration idempotente). En local, pointer `DATABASE_URL` vers un
Postgres local (ajouter `DATABASE_SSL=disable`) ou directement vers Neon.

**Étapes de déploiement**

```bash
# 1) Créer une base sur Neon → récupérer l'URL de connexion (sslmode=require)

# 2) Créer l'app Fly (adapter le nom dans fly.toml)
fly launch --no-deploy   # ou : fly apps create compliance-scan

# 3) Secrets (JAMAIS dans fly.toml qui est versionné)
fly secrets set DATABASE_URL="postgres://user:pass@ep-xxx.eu-central-1.aws.neon.tech/db?sslmode=require"
# Stripe optionnel : sans ces secrets, le paiement est SIMULÉ.
fly secrets set STRIPE_SECRET_KEY="sk_live_..." STRIPE_PRICE_ID="price_..." STRIPE_WEBHOOK_SECRET="whsec_..."

# 4) Déployer
fly deploy
```

L'image part de `mcr.microsoft.com/playwright` : Chromium + ses dépendances sont
déjà présents, donc le scan **et** le rendu PDF (route `/api/documents/[id]/pdf`)
fonctionnent dans le conteneur. Prévoir **1 Go de RAM** (Chromium est gourmand ;
512 Mo = risque d'OOM). Voir [`fly.toml`](fly.toml).

**Migration vers une vraie prod (plus tard, sans réécriture)**

Tout est découplé par variables d'environnement :

- **Redis → Upstash / Fly Redis persistant** : changer `REDIS_URL` et ne plus
  lancer `redis-server` dans `start-container.mjs`.
- **Worker séparé** : sortir `npm run worker` de l'orchestrateur vers une machine
  Fly dédiée (`[processes]`) pour scaler le scan indépendamment du web.
- **Postgres** : déjà externe (Neon) — rien à faire, ou migrer l'URL.

## Décisions clés (rappel)

- **Findings sûrs d'abord** : les heuristiques incertaines sont marquées
  `status: "a_verifier"` (et pèsent moins dans le score) plutôt qu'affirmées,
  pour limiter les faux positifs (PRD §8).
- **Règles découplées du code** : signatures de traceurs en JSON
  (`src/data/trackers.json`) pour mise à jour sans redéploiement lourd.
- **LLM optionnel** : l'extraction des mentions légales passe par un contrat
  `LegalExtractor` ; l'implémentation par défaut est déterministe et hors-ligne,
  un extracteur LLM pourra la remplacer sans toucher au reste.

Voir [`docs/WCAG-COVERAGE.md`](docs/WCAG-COVERAGE.md) pour les critères couverts
et [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) pour les hypothèses prises.
