import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDocumentRow } from '@/lib/documents/store';
import { htmlToPdf } from '@/lib/documents/pdf';

export const runtime = 'nodejs';
// Le rendu PDF pilote un navigateur : pas de limite courte.
export const maxDuration = 60;

/**
 * GET /api/documents/:id/pdf — télécharge le document en PDF (rendu Chromium).
 * Si Chromium est indisponible, renvoie 503 avec un message invitant à utiliser
 * l'export HTML (le frontend propose les deux).
 */
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

  try {
    const pdf = await htmlToPdf(doc.html);
    const filename = `${slugify(doc.title)}.pdf`;
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error:
          "Le rendu PDF a échoué (Chromium indisponible ?). Utilisez l'export " +
          'HTML en attendant. ' +
          message,
      },
      { status: 503 },
    );
  }
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
