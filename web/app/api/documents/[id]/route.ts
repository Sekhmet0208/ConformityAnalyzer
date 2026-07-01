import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDocumentRow } from '@/lib/documents/store';

export const runtime = 'nodejs';

/** GET /api/documents/:id — métadonnées + HTML du document (propriétaire seul). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }
  const doc = await getDocumentRow(id);
  if (!doc || doc.user_id !== user.id) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 });
  }
  return NextResponse.json({
    id: doc.id,
    type: doc.type,
    title: doc.title,
    html: doc.html,
    created_at: doc.created_at,
    scan_id: doc.scan_id,
  });
}
