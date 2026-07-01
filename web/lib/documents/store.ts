import 'server-only';
import { randomUUID } from 'node:crypto';
import { query, type DocumentRow } from '../db';
import type { DocumentContext, DocumentType } from './types';
import { getScanRow } from '../scans-store';
import type { ScanResult } from '../contract';

/** Persistance et pre-remplissage des documents (Lot 4). */

export interface SaveDocumentInput {
  userId: string;
  scanId: string | null;
  type: DocumentType;
  title: string;
  context: DocumentContext;
  html: string;
  generator: string;
}

export async function saveDocument(input: SaveDocumentInput): Promise<string> {
  const id = randomUUID();
  await query(
    `INSERT INTO documents
      (id, user_id, scan_id, type, title, status, context_json, html, generator, created_at)
     VALUES ($1, $2, $3, $4, $5, 'ready', $6, $7, $8, $9)`,
    [
      id,
      input.userId,
      input.scanId,
      input.type,
      input.title,
      JSON.stringify(input.context),
      input.html,
      input.generator,
      new Date().toISOString(),
    ],
  );
  return id;
}

export async function getDocumentRow(
  id: string,
): Promise<DocumentRow | undefined> {
  const res = await query<DocumentRow>(
    'SELECT * FROM documents WHERE id = $1',
    [id],
  );
  return res.rows[0];
}

export async function listDocumentsForUser(
  userId: string,
): Promise<DocumentRow[]> {
  const res = await query<DocumentRow>(
    'SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
    [userId],
  );
  return res.rows;
}

export async function countDocumentsForUser(userId: string): Promise<number> {
  const res = await query<{ n: string }>(
    'SELECT COUNT(*) AS n FROM documents WHERE user_id = $1',
    [userId],
  );
  // pg renvoie COUNT(*) en string (bigint) : on reparse en nombre.
  return Number.parseInt(res.rows[0]?.n ?? '0', 10);
}

/**
 * Pre-remplit un contexte de document a partir d'un scan de l'utilisateur :
 * URL, nom de domaine, traceurs detectes, score d'accessibilite et principales
 * non-conformites a11y. Retourne un contexte partiel (l'utilisateur complete).
 */
export async function contextFromScan(
  scanId: string,
  ownerId: string,
): Promise<DocumentContext> {
  const scan = await getScanRow(scanId);
  if (!scan || scan.user_id !== ownerId || !scan.result_json) return {};
  const result = JSON.parse(scan.result_json) as ScanResult;

  let siteName = '';
  try {
    siteName = new URL(scan.root_url).hostname.replace(/^www\./, '');
  } catch {
    siteName = scan.root_url;
  }

  const a11yIssues = result.findings
    .filter((f) => f.category === 'accessibilite')
    .slice(0, 6)
    .map((f) => f.title);

  return {
    siteName,
    siteUrl: scan.root_url,
    trackers: result.stack.trackers ?? [],
    collectsFormData: result.findings.some(
      (f) => f.id === 'rgpd.form_without_purpose',
    ),
    accessibilityScore: result.score,
    a11yNonConformities: a11yIssues,
  };
}
