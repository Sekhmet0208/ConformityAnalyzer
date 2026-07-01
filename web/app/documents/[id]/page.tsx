import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getDocumentRow } from '@/lib/documents/store';
import DocumentToolbar from '@/components/DocumentToolbar';

export const dynamic = 'force-dynamic';

export default async function DocumentViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/documents/${id}`);

  const doc = await getDocumentRow(id);
  if (!doc || doc.user_id !== user.id) notFound();

  return (
    <div className="doc-page">
      <div className="doc-view-head">
        <div>
          <Link href="/documents" className="link small">
            ← Mes documents
          </Link>
          <h1>{doc.title}</h1>
          <p className="muted small">
            Généré le {new Date(doc.created_at).toLocaleString('fr-FR')} ·
            modèle « {doc.generator} »
          </p>
        </div>
        <DocumentToolbar id={doc.id} title={doc.title} />
      </div>

      <div className="doc-preview">
        <iframe
          title={doc.title}
          srcDoc={doc.html}
          className="doc-frame"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
