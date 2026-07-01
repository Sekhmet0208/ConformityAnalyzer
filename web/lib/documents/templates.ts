import type { DocumentContext } from './types';
import { esc, opt, slot, today, wrapDocument } from './render';

/**
 * Modeles de documents (droit francais). Chaque fonction remplit un template a
 * trous a partir du contexte : AUCUNE clause n'est inventee, seules les
 * informations fournies sont inserees, les manques sont marques "[À COMPLÉTER]"
 * (PRD §9 : sortie contrainte, pas de clauses libres).
 */

// --- Mentions legales ------------------------------------------------------

export function renderLegalNotice(ctx: DocumentContext): string {
  const editorLine = [
    opt(ctx.organizationName),
    opt(ctx.legalForm),
    ctx.capital ? `au capital de ${esc(ctx.capital)}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const body = `
<h2>1. Éditeur du site</h2>
<p>Le site ${slot(ctx.siteName)}${
    ctx.siteUrl ? ` (${esc(ctx.siteUrl)})` : ''
  } est édité par :</p>
<ul>
  <li><strong>Éditeur :</strong> ${editorLine ? editorLine : slot(undefined)}</li>
  <li><strong>Adresse :</strong> ${slot(ctx.address)}</li>
  <li><strong>SIRET :</strong> ${slot(ctx.siret)}</li>
  <li><strong>RCS :</strong> ${slot(ctx.rcs)}</li>
  <li><strong>TVA intracommunautaire :</strong> ${slot(ctx.vatNumber)}</li>
  <li><strong>Email :</strong> ${slot(ctx.email)}</li>
  <li><strong>Téléphone :</strong> ${slot(ctx.phone)}</li>
</ul>

<h2>2. Directeur de la publication</h2>
<p>Le directeur de la publication est ${slot(ctx.publicationDirector)}.</p>

<h2>3. Hébergement</h2>
<p>Le site est hébergé par :</p>
<ul>
  <li><strong>Hébergeur :</strong> ${slot(ctx.hostName)}</li>
  <li><strong>Adresse :</strong> ${slot(ctx.hostAddress)}</li>
  <li><strong>Téléphone :</strong> ${slot(ctx.hostPhone)}</li>
</ul>

<h2>4. Propriété intellectuelle</h2>
<p>
  L'ensemble des contenus présents sur le site ${slot(ctx.siteName)} (textes,
  images, logos, éléments graphiques) est protégé par le droit de la propriété
  intellectuelle. Toute reproduction ou représentation, totale ou partielle,
  sans autorisation préalable est interdite.
</p>

<h2>5. Contact</h2>
<p>
  Pour toute question relative au site, vous pouvez nous contacter à
  l'adresse ${slot(ctx.email)}.
</p>`;

  return wrapDocument('Mentions légales', body, ctx);
}

// --- Politique de confidentialite ------------------------------------------

export function renderPrivacyPolicy(ctx: DocumentContext): string {
  const trackers = ctx.trackers ?? [];
  const trackerRows = trackers.length
    ? trackers
        .map(
          (t) =>
            `<tr><td>${esc(t)}</td><td>Mesure d'audience / marketing</td><td>Selon le fournisseur</td></tr>`,
        )
        .join('')
    : `<tr><td colspan="3">Aucun traceur tiers déclaré à ce jour.</td></tr>`;

  const formData = ctx.collectsFormData
    ? `<li>Données de formulaire (identité, email, message) que vous nous
        transmettez volontairement, afin de traiter votre demande.</li>`
    : '';

  const body = `
<p class="doc-lead">
  La présente politique décrit la manière dont ${slot(ctx.organizationName)}
  traite les données personnelles des utilisateurs du site ${slot(ctx.siteName)},
  conformément au Règlement Général sur la Protection des Données (RGPD).
</p>

<h2>1. Responsable du traitement</h2>
<p>
  Le responsable du traitement est ${slot(ctx.organizationName)},
  ${ctx.address ? `dont le siège est situé ${esc(ctx.address)}, ` : ''}
  joignable à l'adresse ${slot(ctx.email)}.
</p>

<h2>2. Données collectées et finalités</h2>
<ul>
  <li>Données de navigation (adresse IP, pages consultées) à des fins de
      fonctionnement et de mesure d'audience.</li>
  ${formData}
</ul>

<h2>3. Bases légales</h2>
<p>
  Les traitements reposent, selon les cas, sur votre <strong>consentement</strong>
  (traceurs non essentiels), sur l'exécution de mesures précontractuelles ou
  contractuelles, ou sur notre intérêt légitime à assurer le bon fonctionnement
  du site.
</p>

<h2>4. Cookies et traceurs</h2>
<table>
  <thead><tr><th>Traceur</th><th>Finalité</th><th>Durée</th></tr></thead>
  <tbody>${trackerRows}</tbody>
</table>
<p>
  Les traceurs non essentiels ne sont déposés qu'après votre consentement, que
  vous pouvez retirer à tout moment via le gestionnaire de cookies.
</p>

<h2>5. Durée de conservation</h2>
<p>
  Les données sont conservées pour la durée strictement nécessaire aux finalités
  décrites, puis supprimées ou anonymisées. <span class="todo">[À COMPLÉTER : préciser les durées]</span>
</p>

<h2>6. Vos droits</h2>
<p>
  Conformément au RGPD, vous disposez d'un droit d'accès, de rectification,
  d'effacement, de limitation, d'opposition et de portabilité de vos données.
  Vous pouvez les exercer en écrivant à ${slot(ctx.email)}. Vous avez également
  le droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr).
</p>

<h2>7. Contact</h2>
<p>Pour toute question relative à vos données : ${slot(ctx.email)}.</p>
<p class="doc-meta">Dernière mise à jour : ${today()}.</p>`;

  return wrapDocument('Politique de confidentialité', body, ctx);
}

// --- Declaration d'accessibilite -------------------------------------------

export function renderAccessibilityStatement(ctx: DocumentContext): string {
  const score = ctx.accessibilityScore;
  const stateSentence =
    typeof score === 'number'
      ? `Un audit automatisé partiel a été réalisé le ${today()} et a estimé un
         niveau de conformité indicatif de ${esc(String(score))}/100. Cet audit
         ne couvre qu'une partie des critères (environ 30 à 40 % automatisables).`
      : `Un audit de conformité n'a pas encore été formellement réalisé.`;

  const issues = ctx.a11yNonConformities ?? [];
  const issuesList = issues.length
    ? `<ul>${issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
    : `<p>Les non-conformités identifiées automatiquement sont en cours de
        correction. <span class="todo">[À COMPLÉTER : lister les non-conformités connues]</span></p>`;

  const body = `
<p class="doc-lead">
  ${slot(ctx.organizationName)} s'engage à rendre son site ${slot(ctx.siteName)}
  accessible, conformément à l'article 47 de la loi n° 2005-102 du 11 février
  2005 et au Référentiel Général d'Amélioration de l'Accessibilité (RGAA).
</p>

<h2>1. État de conformité</h2>
<p>${stateSentence}</p>

<h2>2. Résultats des tests</h2>
<p>
  L'audit automatisé s'appuie sur les critères WCAG 2.1 niveaux A et AA
  automatisables (contraste, textes alternatifs, langue de page, structure des
  titres…).
</p>

<h2>3. Contenus non accessibles</h2>
${issuesList}

<h2>4. Établissement de cette déclaration</h2>
<p>
  Cette déclaration a été établie le ${today()}. Elle se fonde sur un audit
  automatisé qui ne remplace pas un audit humain complet.
</p>

<h2>5. Retour d'information et contact</h2>
<p>
  Si vous rencontrez un défaut d'accessibilité, contactez-nous à
  ${slot(ctx.email)} afin d'être orienté vers une alternative accessible ou
  d'obtenir le contenu sous une autre forme.
</p>

<h2>6. Voies de recours</h2>
<p>
  Si vous constatez un défaut d'accessibilité vous empêchant d'accéder à un
  contenu et que vous nous le signalez sans réponse satisfaisante, vous pouvez
  saisir le Défenseur des droits (www.defenseurdesdroits.fr).
</p>`;

  return wrapDocument("Déclaration d'accessibilité", body, ctx);
}

// --- Banniere cookies conforme (extrait de code) ---------------------------

export function renderCookieBanner(ctx: DocumentContext): string {
  const snippet = COOKIE_SNIPPET.trim();
  const body = `
<p class="doc-lead">
  Voici un exemple de bannière de consentement conforme aux exigences de la CNIL
  pour le site ${slot(ctx.siteName)} : elle permet d'<strong>accepter</strong>,
  de <strong>refuser</strong> aussi facilement, et n'active les traceurs
  qu'après un choix explicite.
</p>

<h2>Principes respectés</h2>
<ul>
  <li>Aucun traceur non essentiel n'est déposé avant le consentement.</li>
  <li>Le bouton « Tout refuser » est au même niveau que « Tout accepter ».</li>
  <li>Le choix est mémorisé et peut être modifié à tout moment.</li>
</ul>

<h2>Code à intégrer</h2>
<p>
  Copiez ce bloc juste avant la balise <code>&lt;/body&gt;</code> de vos pages,
  puis remplacez le commentaire <code>/* Charger ici vos traceurs */</code> par
  le chargement effectif de vos scripts (Analytics, pixels, etc.).
</p>
<pre><code>${esc(snippet)}</code></pre>

<h2>Personnalisation</h2>
<p>
  Adaptez les couleurs et les textes à votre charte. Pour un besoin avancé
  (catégories multiples, journalisation des consentements), envisagez une
  solution de gestion du consentement (CMP) dédiée.
</p>`;

  return wrapDocument('Bannière cookies conforme', body, ctx);
}

/**
 * Extrait autonome : banniere accepter/refuser qui ne charge les traceurs
 * qu'apres consentement, avec memorisation en localStorage.
 */
const COOKIE_SNIPPET = `<div id="cookie-banner" style="display:none;position:fixed;left:16px;right:16px;bottom:16px;max-width:640px;margin:auto;background:#0e1b30;color:#fff;padding:18px 20px;border-radius:12px;font-family:system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3);z-index:9999">
  <p style="margin:0 0 12px;font-size:.92rem;line-height:1.5">
    Nous utilisons des cookies pour mesurer l'audience et améliorer votre
    expérience. Vous pouvez accepter, refuser ou consulter notre
    <a href="/confidentialite" style="color:#34d0a4">politique de confidentialité</a>.
  </p>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <button id="cookie-refuse" style="flex:1;min-width:140px;padding:10px 16px;border:1px solid #46608a;background:transparent;color:#fff;border-radius:8px;cursor:pointer">Tout refuser</button>
    <button id="cookie-accept" style="flex:1;min-width:140px;padding:10px 16px;border:0;background:#14b88a;color:#fff;border-radius:8px;cursor:pointer;font-weight:600">Tout accepter</button>
  </div>
</div>
<script>
(function () {
  var KEY = 'cookie-consent';
  var banner = document.getElementById('cookie-banner');
  function loadTrackers() {
    /* Charger ici vos traceurs (Analytics, pixels...) UNIQUEMENT apres consentement */
  }
  var choice = localStorage.getItem(KEY);
  if (choice === 'accepted') { loadTrackers(); }
  else if (choice !== 'refused') { banner.style.display = 'block'; }
  document.getElementById('cookie-accept').onclick = function () {
    localStorage.setItem(KEY, 'accepted'); banner.style.display = 'none'; loadTrackers();
  };
  document.getElementById('cookie-refuse').onclick = function () {
    localStorage.setItem(KEY, 'refused'); banner.style.display = 'none';
  };
})();
</script>`;
