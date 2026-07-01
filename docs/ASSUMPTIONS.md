# Hypothèses et décisions d'implémentation — Lot 1

Ce document recense les hypothèses prises (PRD §9) et les limites connues.

## Périmètre

- Seul le **Lot 1** est implémenté : cœur de scan testable en CLI, **sans UI**,
  sans comptes, sans paiement, sans génération de documents, sans monitoring.
- Les Lots 2–5 (rapport web/landing, auth/Stripe, génération de documents,
  suivi/veille) sont **hors de ce livrable** mais l'architecture les anticipe
  (findings normalisés, verrouillage freemium, extracteur LLM enfichable).

## Juridique

- L'outil ne fournit **aucun conseil juridique** ; il produit des constats
  indicatifs. Le `LEGAL_DISCLAIMER` (constante unique, `src/constants.ts`) est
  inclus dans **chaque** rapport (PRD §8, §9).
- Les règles « mentions légales » ciblent le **droit français v1** (LCEN). Le
  module est extensible à d'autres juridictions.
- Le SIRET/RCS est traité comme **mineur** car il ne s'applique pas à tous les
  éditeurs (association, particulier).

## Précision des détections (anti-faux-positifs)

- Stratégie **« constats sûrs d'abord »** (PRD §8). Deux statuts :
  - `confirme` : preuve directe (cookie traceur présent avant consentement,
    page de mentions légales absente, violation axe…).
  - `a_verifier` : heuristique pouvant générer un faux positif (mention de
    finalité d'un formulaire, symétrie accepter/refuser, lien non global…).
- Les findings `a_verifier` **pèsent moins** dans le score
  (`TO_VERIFY_WEIGHT_FACTOR = 0.4`) pour ne pas pénaliser à tort.

## Crawler

- **Navigateur** : Chromium headless via Playwright (rendu JS requis pour
  capter les bannières injectées côté client).
- **robots.txt** : respecté par défaut. Parseur maison gérant
  `User-agent`/`Allow`/`Disallow`/`Crawl-delay`, les jokers `*` et l'ancre `$`,
  avec précedence au chemin le plus spécifique (Allow l'emporte à égalité).
  `--no-robots` permet de le désactiver (tests, sites qu'on possède).
- **nofollow** : les liens `rel="nofollow"` ne sont pas suivis.
- **Limites** : profondeur par défaut 2 ; pages max **5 (free) / 50 (paid)** ;
  timeout 15 s par page, **1 retry**.
- **Même-site** : on reste sur le même domaine enregistrable (eTLD+1), ce qui
  autorise les sous-domaines (`www`, `blog`). Pour `localhost`/IP, repli sur le
  hostname.
- **Consentement simulé** : on détecte une bannière (sélecteurs de CMP connues +
  libellés FR/EN d'acceptation) et on clique « Accepter » pour comparer
  réseau/cookies **avant/après**. Si aucun bouton n'est trouvé, `afterConsent`
  reste `null`.

## RGPD / cookies

- Base de **signatures de traceurs** dans `src/data/trackers.json` (domaines,
  motifs de scripts, noms de cookies), **découplée du code** (PRD §8) pour mise
  à jour sans redéploiement.
- Un cookie est rattaché à un traceur par **nom exact ou préfixe** (ex: `_ga`,
  `_ga_XXXX`).
- `requiresConsent: false` pour les traceurs purement fonctionnels (ex: Stripe),
  qui ne déclenchent pas de constat « avant consentement ».
- Hypothèse forte : tout cookie/traceur connu nécessitant consentement, présent
  **avant** toute acceptation, est une **violation critique**.

## Mentions légales

- Détection de la page candidate par **URL → titre → ancre** (dans cet ordre).
- L'extraction des éléments obligatoires passe par un contrat
  `LegalExtractor`. L'implémentation par défaut est **heuristique et
  déterministe** (regex prudentes) pour rester testable hors-ligne ; un
  extracteur **LLM** (extraction sémantique, PRD §3.3) pourra la remplacer sans
  changer l'analyseur. Quand le LLM sera branché, ses sorties devront être
  **contraintes/validées** (PRD §9).
- Signal fort → `present` ; signal faible → `incertain` (`a_verifier`) ; sinon
  `manquant` (`confirme`).

## Accessibilité

- Audit **axe-core** restreint à WCAG 2.1 A/AA automatisables. Voir
  [`WCAG-COVERAGE.md`](WCAG-COVERAGE.md) pour le détail couvert/non couvert.
- Mapping d'impact axe → sévérité : `critical`/`serious` → **important**,
  `moderate`/`minor` → **mineur**. (Aucune violation axe n'est classée
  « critique » : les blocages critiques de conformité concernent le RGPD et les
  mentions légales.)
- axe est exécuté sur l'**état initial** de la page (bannière éventuellement
  présente), au plus proche de l'expérience au chargement.

## Score

- Score `= 100 − Σ pénalités`, borné `[0, 100]`. Poids :
  **critique 15**, **important 7**, **mineur 2** ; facteur `0.4` pour
  `a_verifier`. Note `A–E` dérivée du score.
- Le score est calculé sur **tous** les findings (le freemium connaît son
  score) ; seuls les **détails** sont verrouillés en gratuit.

## Anti-abus

- Vérification minimale dans la CLI : refus des hôtes sans **suffixe public**
  valide (sauf `localhost`/`127.0.0.1` pour les tests). La **vérification de
  propriété du domaine** (recommandée avant suivi récurrent, PRD §8) relève des
  Lots ultérieurs.

## Limites connues

- Les bannières très atypiques peuvent ne pas être cliquées → la comparaison
  avant/après peut manquer ; on se rabat alors sur la détection « avant
  consentement » seule.
- Les ressources tierces réelles (ex: `googletagmanager.com`) sont effectivement
  requêtées pendant le scan ; en environnement hors-ligne, elles échouent sans
  bloquer le scan.
- Pas de cache ni de batching dans ce lot (optimisations coût prévues plus
  tard, PRD §8).
