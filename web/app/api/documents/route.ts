import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canGenerateDocuments } from '@/lib/entitlement';
import { tierOverrideEnabled } from '@/lib/validate';
import { getDocumentGenerator } from '@/lib/documents/generator';
import {
  contextFromScan,
  listDocumentsForUser,
  saveDocument,
} from '@/lib/documents/store';
import { DOCUMENT_TYPES, type DocumentContext, type DocumentType } from '@/lib/documents/types';

export const runtime = 'nodejs';

/** GET /api/documents — liste des documents de l'utilisateur. */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }
  const docs = (await listDocumentsForUser(user.id)).map((d) => ({
    id: d.id,
    type: d.type,
    title: d.title,
    created_at: d.created_at,
    scan_id: d.scan_id,
  }));
  return NextResponse.json({ documents: docs });
}

/**
 * POST /api/documents { type, context?, scanId? }
 * Genere un document (templates deterministes). Reserve aux comptes payants
 * (ou override dev). Pre-remplit depuis un scan si scanId est fourni.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }
  if (!canGenerateDocuments(user, tierOverrideEnabled())) {
    return NextResponse.json(
      {
        error:
          'La génération de documents est réservée aux comptes abonnés. ' +
          'Passez à l’offre Essentiel pour l’activer.',
        code: 'upgrade_required',
      },
      { status: 402 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const { type, context, scanId } = (body ?? {}) as {
    type?: string;
    context?: DocumentContext;
    scanId?: string;
  };

  if (!type || !DOCUMENT_TYPES.includes(type as DocumentType)) {
    return NextResponse.json(
      { error: 'Type de document invalide.' },
      { status: 400 },
    );
  }
  const docType = type as DocumentType;

  // Contexte = pre-remplissage scan (si fourni et possede) + saisie utilisateur.
  const prefilled = scanId ? await contextFromScan(scanId, user.id) : {};
  const merged: DocumentContext = { ...prefilled, ...(context ?? {}) };

  const generated = getDocumentGenerator().generate(docType, merged);
  const id = await saveDocument({
    userId: user.id,
    scanId: scanId ?? null,
    type: docType,
    title: generated.title,
    context: merged,
    html: generated.html,
    generator: generated.generator,
  });

  return NextResponse.json({ id, title: generated.title }, { status: 201 });
}
