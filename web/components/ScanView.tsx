'use client';

import { useEffect, useRef, useState } from 'react';
import type { JobStatusResponse } from '@/lib/contract';
import ReportView from '@/components/ReportView';

const PHASES = [
  'Exploration des pages',
  'Cookies & traceurs',
  'Accessibilité',
  'Mentions légales',
];

export default function ScanView({
  id,
  loggedIn,
  hasPlan,
}: {
  id: string;
  loggedIn: boolean;
  hasPlan: boolean;
}) {
  const [data, setData] = useState<JobStatusResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/scans/${id}`, { cache: 'no-store' });
        const json: JobStatusResponse = await res.json();
        if (cancelled) return;
        setData(json);
        if (json.status === 'done' || json.status === 'failed' || json.status === 'not_found') {
          return; // stop polling
        }
      } catch {
        if (cancelled) return;
        setFetchError('Connexion au serveur perdue. Nouvelle tentative…');
      }
      timer.current = setTimeout(poll, 1500);
    }

    poll();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id]);

  // Rapport prêt
  if (data?.status === 'done' && data.result) {
    return (
      <ReportView
        report={data.result}
        loggedIn={loggedIn}
        hasPlan={hasPlan}
      />
    );
  }

  // Échec
  if (data?.status === 'failed' || data?.status === 'not_found') {
    return (
      <div className="error-card">
        <h2>Le scan n&apos;a pas abouti</h2>
        <p>
          {data.status === 'not_found'
            ? "Ce scan est introuvable ou a expiré. Relancez une analyse depuis l'accueil."
            : 'Une erreur est survenue pendant l\'analyse de votre site.'}
        </p>
        {data.error && <code>{data.error}</code>}
        <a className="back-link" href="/">
          ← Lancer un nouveau scan
        </a>
      </div>
    );
  }

  // En cours
  const progress = data?.progress ?? 5;
  const activePhase = Math.min(
    PHASES.length - 1,
    Math.floor((progress / 100) * PHASES.length),
  );

  return (
    <div className="progress-wrap">
      <div className="progress-card">
        <div className="spinner" aria-hidden="true" />
        <h2>Analyse de votre site en cours…</h2>
        <p style={{ color: 'var(--ink-500)', marginTop: 8 }}>
          Cela prend généralement entre 10 et 60 secondes. Vous pouvez laisser
          cette page ouverte.
        </p>
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${Math.max(5, progress)}%` }} />
        </div>
        <div className="progress-steps">
          {PHASES.map((label, i) => (
            <span key={label} className={i <= activePhase ? 'on' : ''}>
              {i <= activePhase ? '● ' : '○ '}
              {label}
            </span>
          ))}
        </div>
        {fetchError && (
          <p style={{ color: 'var(--warn-600)', marginTop: 16, fontSize: '0.85rem' }}>
            {fetchError}
          </p>
        )}
      </div>
    </div>
  );
}
