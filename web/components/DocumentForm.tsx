'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  DOCUMENT_META,
  fieldsForType,
  type DocumentContext,
  type DocumentType,
} from '@/lib/documents/types';

interface Props {
  type: DocumentType;
  /** Contexte pré-rempli depuis le dernier scan (facultatif). */
  prefill: DocumentContext;
  scanId: string | null;
}

export default function DocumentForm({ type, prefill, scanId }: Props) {
  const router = useRouter();
  const meta = DOCUMENT_META[type];
  const fields = fieldsForType(type);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      const v = prefill[f.name];
      init[f.name] = typeof v === 'string' ? v : '';
    }
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Contexte = valeurs saisies + éléments non éditables du préremplissage
    // (traceurs, score a11y, etc.) conservés pour le template.
    const context: DocumentContext = {
      ...prefill,
      ...Object.fromEntries(
        Object.entries(values).filter(([, v]) => v.trim() !== ''),
      ),
    };

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, context, scanId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'La génération a échoué.');
        setSubmitting(false);
        return;
      }
      router.push(`/documents/${data.id}`);
    } catch {
      setError('Impossible de contacter le serveur.');
      setSubmitting(false);
    }
  }

  return (
    <div className="doc-form-wrap">
      <div className="doc-form-head">
        <span className="doc-ico big">{meta.icon}</span>
        <div>
          <h1>{meta.label}</h1>
          <p className="muted">{meta.description}</p>
        </div>
      </div>

      {scanId && (
        <p className="prefill-note">
          ✨ Certains champs ont été pré-remplis à partir de votre dernier scan.
          Vérifiez-les et complétez le reste.
        </p>
      )}

      <form onSubmit={onSubmit} className="doc-form">
        {fields.map((f) => (
          <label className="field" key={String(f.name)}>
            <span>
              {f.label}
              {f.required && <em className="req"> *</em>}
            </span>
            <input
              type={f.type ?? 'text'}
              value={values[f.name as string] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => set(f.name as string, e.target.value)}
              disabled={submitting}
            />
            {f.help && <small className="hint">{f.help}</small>}
          </label>
        ))}

        {error && <div className="form-error">{error}</div>}

        <div className="doc-form-actions">
          <button className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Génération…' : 'Générer le document'}
          </button>
          <p className="muted small">
            Les champs laissés vides apparaîtront comme « [À COMPLÉTER] » dans le
            document.
          </p>
        </div>
      </form>
    </div>
  );
}
