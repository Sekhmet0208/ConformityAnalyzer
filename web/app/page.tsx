import ScanForm from '@/components/ScanForm';
import { tierOverrideEnabled } from '@/lib/validate';

export default function HomePage() {
  const tierOverride = tierOverrideEnabled();

  return (
    <>
      <section className="hero">
        <span className="eyebrow">
          <span aria-hidden="true">✦</span> RGPD · Cookies · Accessibilité ·
          Mentions légales
        </span>
        <h1>
          Votre site est-il <span className="hl">en conformité</span> ?
        </h1>
        <p className="lede">
          Scannez votre site en moins d&apos;une minute et découvrez vos
          problèmes de conformité avant qu&apos;ils ne deviennent des amendes.
          Sans inscription, sans engagement.
        </p>

        <ScanForm tierOverride={tierOverride} />

        <div className="trust-row">
          <span>
            <span className="dot">●</span> Aucune donnée revendue
          </span>
          <span>
            <span className="dot">●</span> robots.txt respecté
          </span>
          <span>
            <span className="dot">●</span> Analyse côté serveur
          </span>
        </div>
      </section>

      <section className="section" id="fonctionnement">
        <div className="section-head">
          <h2>Ce que nous vérifions</h2>
          <p>Quatre domaines de conformité, automatiquement analysés.</p>
        </div>
        <div className="grid-3">
          <article className="feature">
            <div className="ico">🍪</div>
            <h3>Cookies &amp; traceurs</h3>
            <p>
              Détection des cookies et traceurs déposés avant consentement,
              absence de bannière conforme, refus aussi simple que
              l&apos;acceptation.
            </p>
          </article>
          <article className="feature">
            <div className="ico">🛡️</div>
            <h3>RGPD</h3>
            <p>
              Présence d&apos;une politique de confidentialité, formulaires
              collectant des données sans mention de finalité, traceurs
              publicitaires connus.
            </p>
          </article>
          <article className="feature">
            <div className="ico">♿</div>
            <h3>Accessibilité</h3>
            <p>
              Audit WCAG 2.1 A &amp; AA automatisable : contraste, textes
              alternatifs, langue de page, structure des titres.
            </p>
          </article>
          <article className="feature">
            <div className="ico">⚖️</div>
            <h3>Mentions légales</h3>
            <p>
              Vérification de la page obligatoire et de ses éléments : éditeur,
              hébergeur, directeur de publication, contact, SIRET/RCS.
            </p>
          </article>
          <article className="feature">
            <div className="ico">📊</div>
            <h3>Score &amp; priorisation</h3>
            <p>
              Un score sur 100 et des constats classés par gravité, du plus
              critique au plus mineur, avec une action concrète pour chacun.
            </p>
          </article>
          <article className="feature">
            <div className="ico">🔍</div>
            <h3>Constats fiables</h3>
            <p>
              Les détections incertaines sont signalées « à vérifier » plutôt
              qu&apos;affirmées : on privilégie la confiance à l&apos;alarmisme.
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Comment ça marche</h2>
          <p>Trois étapes, aucune compétence technique requise.</p>
        </div>
        <div className="steps">
          <article className="step">
            <h3>Saisissez votre URL</h3>
            <p>
              Indiquez l&apos;adresse de votre site. Notre robot explore vos
              pages comme un navigateur réel.
            </p>
          </article>
          <article className="step">
            <h3>Analyse automatique</h3>
            <p>
              Nous simulons la navigation, observons les cookies et traceurs, et
              auditons l&apos;accessibilité et vos mentions légales.
            </p>
          </article>
          <article className="step">
            <h3>Rapport actionnable</h3>
            <p>
              Recevez un rapport priorisé. Débloquez les corrections détaillées
              et générez vos documents manquants.
            </p>
          </article>
        </div>
      </section>

      <section className="section" id="tarifs">
        <div className="section-head">
          <h2>Tarifs</h2>
          <p>Le scan est gratuit. Débloquez les corrections quand vous voulez.</p>
        </div>
        <div className="pricing">
          <article className="plan">
            <h3>Découverte</h3>
            <div className="price">
              0 € <small>/ scan</small>
            </div>
            <ul>
              <li>Score de conformité</li>
              <li>Liste des problèmes détectés</li>
              <li>Jusqu&apos;à 5 pages analysées</li>
            </ul>
          </article>
          <article className="plan featured">
            <h3>Essentiel</h3>
            <div className="price">
              29 € <small>/ mois</small>
            </div>
            <ul>
              <li>Détail complet des constats</li>
              <li>Recommandations de correction</li>
              <li>Génération de 2 documents légaux</li>
              <li>Jusqu&apos;à 50 pages</li>
            </ul>
          </article>
          <article className="plan">
            <h3>Pro</h3>
            <div className="price">
              99 € <small>/ mois</small>
            </div>
            <ul>
              <li>Tout l&apos;Essentiel</li>
              <li>Surveillance &amp; re-scan périodique</li>
              <li>Plusieurs domaines</li>
              <li>Export PDF</li>
            </ul>
          </article>
        </div>
      </section>
    </>
  );
}
