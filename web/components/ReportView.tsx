'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  type Category,
  type Finding,
  type ScanResult,
} from '@/lib/contract';
import UnlockButton from '@/components/UnlockButton';

function scoreColor(score: number): string {
  if (score >= 75) return 'var(--accent-500)';
  if (score >= 45) return 'var(--warn-600)';
  return 'var(--crit-600)';
}

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const r = 64;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * c;
  const color = scoreColor(score);
  return (
    <div className="gauge">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="var(--ink-100)"
          strokeWidth="14"
        />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div style={{ marginTop: -118, marginBottom: 70 }}>
        <div className="score-num" style={{ color }}>
          {score}
        </div>
        <div className="score-grade">/ 100 · note {grade}</div>
      </div>
    </div>
  );
}

const CATEGORIES: Category[] = [
  'cookies',
  'rgpd',
  'mentions_legales',
  'accessibilite',
];

export default function ReportView({
  report,
  loggedIn,
  hasPlan,
}: {
  report: ScanResult;
  loggedIn: boolean;
  hasPlan: boolean;
}) {
  const [filter, setFilter] = useState<Category | 'all'>('all');
  // Le serveur a deja caviarde selon les droits : s'il reste des findings
  // verrouilles, c'est que le visiteur n'est pas (encore) habilite.
  const hasLocked = report.findings.some((f) => f.locked);

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? report.findings
        : report.findings.filter((f) => f.category === filter),
    [filter, report.findings],
  );

  return (
    <div className="report">
      <div className="report-top">
        <ScoreGauge score={report.score} grade={report.grade} />
        <div className="report-summary">
          <h1>Rapport de conformité</h1>
          <div className="report-url">{report.scan.root_url}</div>

          <div className="stat-row">
            <div className="stat crit">
              <div className="n">{report.summary.by_severity.critique}</div>
              <div className="l">Critiques</div>
            </div>
            <div className="stat warn">
              <div className="n">{report.summary.by_severity.important}</div>
              <div className="l">Importants</div>
            </div>
            <div className="stat minor">
              <div className="n">{report.summary.by_severity.mineur}</div>
              <div className="l">Mineurs</div>
            </div>
            <div className="stat">
              <div className="n">{report.scan.pages_crawled}</div>
              <div className="l">Pages analysées</div>
            </div>
          </div>

          <div className="stack-line">
            Technologie :{' '}
            <code>{report.stack.cms ?? 'CMS inconnu'}</code>{' '}
            {report.stack.cmp ? (
              <>
                · Gestion du consentement <code>{report.stack.cmp}</code>{' '}
              </>
            ) : (
              <>· Aucune bannière de consentement détectée </>
            )}
            {report.stack.trackers.length > 0 && (
              <>· Traceurs : {report.stack.trackers.join(', ')}</>
            )}
          </div>
        </div>
      </div>

      {hasLocked && (
        <UnlockBanner
          total={report.summary.total}
          loggedIn={loggedIn}
          hasPlan={hasPlan}
        />
      )}

      <div className="filters" role="tablist" aria-label="Filtrer par catégorie">
        <button
          className={`chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tout ({report.findings.length})
        </button>
        {CATEGORIES.map((cat) => {
          const n = report.summary.by_category[cat];
          return (
            <button
              key={cat}
              className={`chip ${filter === cat ? 'active' : ''}`}
              onClick={() => setFilter(cat)}
            >
              {CATEGORY_LABELS[cat]} ({n})
            </button>
          );
        })}
      </div>

      <div className="findings">
        {filtered.length === 0 && (
          <p style={{ color: 'var(--ink-500)', padding: '20px 0' }}>
            Aucun problème détecté dans cette catégorie. 🎉
          </p>
        )}
        {filtered.map((f, i) => (
          <FindingCard key={`${f.id}-${i}`} finding={f} />
        ))}
      </div>

      {!hasLocked && hasPlan && (
        <div className="doc-cta">
          <div>
            <h3>📄 Générez vos documents manquants</h3>
            <p>
              À partir de ce scan, produisez en un clic vos mentions légales,
              politique de confidentialité, déclaration d’accessibilité et
              bannière cookies conforme.
            </p>
          </div>
          <Link className="btn btn-primary" href="/documents">
            Générer mes documents
          </Link>
        </div>
      )}

      <p
        style={{
          marginTop: 30,
          fontSize: '0.82rem',
          color: 'var(--ink-400)',
          lineHeight: 1.6,
        }}
      >
        {report.disclaimer}
      </p>

      <a className="back-link" href="/">
        ← Scanner un autre site
      </a>
    </div>
  );
}

/**
 * Banniere de deverrouillage (paywall). Le CTA s'adapte a l'etat du visiteur :
 *  - non connecte   -> inscription (en revenant ensuite sur ce rapport)
 *  - connecte, free -> bouton d'abonnement (Stripe ou simulation dev)
 *  - connecte, paid -> le scan n'est pas rattache a son compte
 */
function UnlockBanner({
  total,
  loggedIn,
  hasPlan,
}: {
  total: number;
  loggedIn: boolean;
  hasPlan: boolean;
}) {
  const pathname = usePathname();
  return (
    <div className="unlock-banner">
      <div>
        <h3>🔒 {total} problèmes détectés</h3>
        <p>
          Le détail et les corrections sont verrouillés. Débloquez le rapport
          complet, les recommandations pas-à-pas et la génération de vos
          documents légaux.
        </p>
      </div>
      {!loggedIn ? (
        <Link
          className="btn"
          href={`/signup?next=${encodeURIComponent(pathname)}`}
        >
          Créer un compte pour débloquer
        </Link>
      ) : !hasPlan ? (
        <UnlockButton className="btn" label="Débloquer (29 €/mois)" />
      ) : (
        <span className="unlock-note">
          Ce scan n&apos;est pas rattaché à votre compte abonné.
        </span>
      )}
    </div>
  );
}

function FindingCard({ finding: f }: { finding: Finding }) {
  return (
    <article className={`finding sev-${f.severity}`}>
      <div className="finding-head">
        <h3 className="finding-title">{f.title}</h3>
        <div className="badges">
          <span className={`badge sev-${f.severity}`}>
            {SEVERITY_LABELS[f.severity]}
          </span>
          <span className="badge cat">{CATEGORY_LABELS[f.category]}</span>
          {f.wcag_ref && <span className="badge wcag">WCAG {f.wcag_ref}</span>}
          {f.status === 'a_verifier' && (
            <span className="badge verify">À vérifier</span>
          )}
        </div>
      </div>

      {f.locked ? (
        <div className="locked-body">
          <span className="lock-ico" aria-hidden="true">
            🔒
          </span>
          Détails et correction verrouillés — disponibles avec une offre payante.
        </div>
      ) : (
        <>
          <div className="finding-body">
            {f.evidence.url && (
              <div className="row">
                <span className="k">URL</span>
                <code>{f.evidence.url}</code>
              </div>
            )}
            {f.evidence.selector && (
              <div className="row">
                <span className="k">Élément</span>
                <code>{f.evidence.selector}</code>
              </div>
            )}
            {f.evidence.detail && (
              <div className="row" style={{ marginTop: 8 }}>
                {f.evidence.detail}
              </div>
            )}
          </div>
          <div className="reco">
            <strong>Action recommandée : </strong>
            {f.recommendation}
          </div>
        </>
      )}
    </article>
  );
}
