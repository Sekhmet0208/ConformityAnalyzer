'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  /** Affiche le commutateur de palier (override dev) si vrai. */
  tierOverride: boolean;
}

export default function ScanForm({ tierOverride }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [paid, setPaid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          tier: tierOverride && paid ? 'paid' : 'free',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.');
        setSubmitting(false);
        return;
      }
      router.push(`/scan/${data.id}`);
    } catch {
      setError('Impossible de contacter le serveur. Réessayez.');
      setSubmitting(false);
    }
  }

  return (
    <div className="scan-card">
      <form className="scan-form" onSubmit={onSubmit}>
        <div className="scan-input-wrap">
          <span className="globe" aria-hidden="true">
            🌐
          </span>
          <input
            className="scan-input"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://votre-site.fr"
            aria-label="Adresse de votre site web"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={submitting}
            required
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Analyse en cours…' : 'Scanner gratuitement'}
        </button>
      </form>

      <div className="scan-meta-row">
        <span className="scan-hint">
          Gratuit, sans inscription · résultat en moins d&apos;une minute.
        </span>
        {tierOverride && (
          <label className="tier-toggle" title="Mode développeur : déverrouille le rapport complet sans paiement">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
            />
            Mode dev : rapport complet (payant simulé)
          </label>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
