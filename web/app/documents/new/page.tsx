import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { canGenerateDocuments } from '@/lib/entitlement';
import { tierOverrideEnabled } from '@/lib/validate';
import DocumentForm from '@/components/DocumentForm';
import { contextFromScan } from '@/lib/documents/store';
import { listScansForUser } from '@/lib/scans-store';
import {
  DOCUMENT_TYPES,
  type DocumentContext,
  type DocumentType,
} from '@/lib/documents/types';

export const dynamic = 'force-dynamic';

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; scanId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/documents');
  if (!canGenerateDocuments(user, tierOverrideEnabled())) {
    redirect('/documents');
  }

  const { type: rawType, scanId: rawScanId } = await searchParams;
  const type = (DOCUMENT_TYPES as string[]).includes(rawType ?? '')
    ? (rawType as DocumentType)
    : 'legal_notice';

  // Pré-remplissage : scan explicite, sinon dernier scan terminé de l'utilisateur.
  let scanId = rawScanId ?? null;
  if (!scanId) {
    const lastDone = (await listScansForUser(user.id)).find(
      (s) => s.status === 'done' && s.result_json,
    );
    scanId = lastDone?.id ?? null;
  }
  const prefill: DocumentContext = scanId
    ? await contextFromScan(scanId, user.id)
    : {};

  return (
    <div className="doc-page">
      <DocumentForm type={type} prefill={prefill} scanId={scanId} />
    </div>
  );
}
