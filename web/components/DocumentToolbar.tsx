'use client';

import { useState } from 'react';

interface Props {
  id: string;
  title: string;
}

export default function DocumentToolbar({ id, title }: Props) {
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  async function downloadPdf() {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const res = await fetch(`/api/documents/${id}/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPdfError(data.error ?? 'Le PDF n’a pas pu être généré.');
        setPdfLoading(false);
        return;
      }
      const blob = await res.blob();
      triggerDownload(blob, `${slug(title)}.pdf`);
    } catch {
      setPdfError('Erreur réseau pendant la génération du PDF.');
    }
    setPdfLoading(false);
  }

  return (
    <div className="doc-toolbar">
      <a className="btn btn-ghost" href={`/api/documents/${id}/html`}>
        ⬇︎ HTML
      </a>
      <button className="btn btn-primary" onClick={downloadPdf} disabled={pdfLoading}>
        {pdfLoading ? 'Génération du PDF…' : '⬇︎ PDF'}
      </button>
      {pdfError && <span className="inline-error">{pdfError}</span>}
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
