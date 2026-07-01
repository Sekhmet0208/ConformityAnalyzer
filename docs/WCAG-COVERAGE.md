# Couverture WCAG 2.1 (A & AA) — ce qui est couvert vs non couvert

Conformément au PRD (§2.2 et §9), cet outil ne couvre que la **partie
automatisable** de WCAG, soit environ **30–40 %** des critères. L'audit
accessibilité s'appuie sur **axe-core**, restreint aux tags suivants :
`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.

Un constat axe est de **haute certitude** : tous les findings d'accessibilité
sont donc émis avec `status: "confirme"`.

## Critères explicitement demandés par le PRD (§3.4) — COUVERTS

| Critère PRD              | Règle axe-core                              | Réf. WCAG |
| ------------------------ | ------------------------------------------- | --------- |
| Images sans `alt`        | `image-alt`, `input-image-alt`, `area-alt`  | 1.1.1     |
| Contraste insuffisant    | `color-contrast`                            | 1.4.3     |
| Langue de page           | `html-has-lang`, `html-lang-valid`          | 3.1.1     |
| Structure de titres      | `heading-order`, `empty-heading`, `page-has-heading-one` | 1.3.1 / 2.4.6 |

## Autres critères automatisables — COUVERTS (via axe-core)

Liste non exhaustive des règles également remontées lorsqu'elles s'appliquent :

- **Noms accessibles** : `link-name` (2.4.4), `button-name` (4.1.2),
  `document-title` (2.4.2).
- **Formulaires** : `label` (1.3.1 / 4.1.2), `select-name`, `aria-input-field-name`.
- **Structure & ARIA** : `aria-required-attr`, `aria-roles`,
  `aria-valid-attr-value`, `duplicate-id-aria`, `list`, `listitem`,
  `definition-list` (1.3.1 / 4.1.1 / 4.1.2).
- **Média** : `video-caption` (1.2.2), `object-alt` (1.1.1).
- **Navigation** : `bypass` (2.4.1), `frame-title` (2.4.1 / 4.1.2),
  `tabindex` (anti-pattern).
- **Tableaux** : `td-headers-attr`, `th-has-data-cells`, `scope-attr-valid`
  (1.3.1).
- **Présentation** : `meta-viewport` (1.4.4 — zoom non bloqué).

> La liste exacte dépend de la version d'axe-core installée. Les références WCAG
> sont dérivées automatiquement des tags `wcagXYZ` d'axe (ex: `wcag111` →
> `1.1.1`) et reportées dans le champ `wcag_ref` du finding.

## NON couverts (nécessitent un audit humain/expert)

Ces critères ne peuvent **pas** être validés de façon fiable automatiquement et
sont **hors périmètre** (PRD §2.2). Leur absence de finding ne signifie pas la
conformité.

- **1.1.1 (qualité du texte alternatif)** : la *présence* d'un `alt` est
  testée, mais pas sa *pertinence* (un `alt="image"` passe le test mais reste
  inutile).
- **1.2.x média temporel** : exactitude des sous-titres, audiodescription,
  transcriptions, langue des signes.
- **1.3.1 (relations)** : une partie est automatisable ; la cohérence sémantique
  globale (ordre de lecture, regroupements logiques) ne l'est pas.
- **1.3.2 (ordre séquentiel logique)** — jugement humain.
- **1.4.1 (information par la couleur seule)** — nécessite interprétation.
- **1.4.3 / 1.4.11 (contraste)** : le contraste du **texte** est testé ; le
  contraste d'éléments graphiques porteurs d'information et certains états
  (focus, survol) sont partiels.
- **2.1.x (clavier)** : l'accessibilité réelle au clavier, les pièges au clavier
  et l'ordre de tabulation effectif nécessitent un test manuel.
- **2.4.3 (ordre de focus)**, **2.4.7 (visibilité du focus)** — test manuel.
- **2.4.6 (intitulés et étiquettes pertinents)** : présence testable, pertinence
  non.
- **2.5.x (modalités de saisie)** — test manuel.
- **3.1.2 (langue d'un passage)** — détection non fiable automatiquement.
- **3.2.x (prévisibilité)** — comportement à l'usage, test manuel.
- **3.3.x (assistance à la saisie)** : messages d'erreur, suggestions de
  correction, prévention des erreurs — largement manuels.
- **4.1.3 (messages d'état)** — test manuel.

## Conséquences produit

- Le rapport doit indiquer que l'audit accessibilité est **partiel** et ne
  remplace pas un audit RGAA/WCAG complet (disclaimer systématique).
- Aucun finding d'accessibilité ≠ site accessible : c'est une **absence de
  violations automatiquement détectables**.
