import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDocumentRow } from '@/lib/documents/store';

export const runtime = 'nodejs';

/** GET /api/documents/:id/html — télécharge le document au format HTML. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }
  const doc = await getDocumentRow(id);
  if (!doc || doc.user_id !== user.id) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 });
  }
  const filename = `${slugify(doc.title)}.html`;
  return new Response(doc.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
