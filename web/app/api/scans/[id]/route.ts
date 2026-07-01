import { NextResponse } from 'next/server';
import { getJobSnapshot } from '@/lib/queue';
import { getCurrentUser } from '@/lib/auth';
import {
  getScanRow,
  markScanStatus,
  persistScanResult,
} from '@/lib/scans-store';
import { isScanUnlocked, redactForViewer } from '@/lib/entitlement';
import type { JobStatusResponse, ScanResult } from '@/lib/contract';

export const runtime = 'nodejs';

/**
 * GET /api/scans/:id
 * Renvoie l'etat du scan et, une fois termine, le rapport — CAVIARDE selon les
 * droits du visiteur (paywall applique a la lecture). Persiste le resultat en
 * base au premier "done" observe.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Identifiant manquant.' }, { status: 400 });
  }

  const scan = await getScanRow(id);
  if (!scan) {
    return json({ id, status: 'not_found', progress: 0, result: null, error: null, unlocked: false });
  }

  const user = await getCurrentUser();
  const unlocked = isScanUnlocked(scan, user);

  // 1) Resultat deja persiste : on le sert directement (apres caviardage).
  if (scan.status === 'done' && scan.result_json) {
    const full = JSON.parse(scan.result_json) as ScanResult;
    return json({
      id,
      status: 'done',
      progress: 100,
      result: redactForViewer(full, unlocked),
      error: null,
      unlocked,
    });
  }

  // 2) Sinon, on interroge la file pour connaitre l'avancement.
  try {
    const snapshot = scan.job_id ? await getJobSnapshot(scan.job_id) : null;

    if (!snapshot) {
      // Job introuvable (expire) et pas de resultat persiste -> perdu.
      if (scan.status !== 'done') await markScanStatus(id, 'failed');
      return json({
        id,
        status: 'failed',
        progress: 0,
        result: null,
        error: 'Resultat indisponible (scan expire). Relancez une analyse.',
        unlocked,
      });
    }

    if (snapshot.status === 'done' && snapshot.result) {
      // Premier "done" observe : on persiste le rapport COMPLET en base.
      await persistScanResult(id, snapshot.result);
      return json({
        id,
        status: 'done',
        progress: 100,
        result: redactForViewer(snapshot.result, unlocked),
        error: null,
        unlocked,
      });
    }

    if (snapshot.status === 'failed') {
      await markScanStatus(id, 'failed');
    } else if (snapshot.status === 'running' && scan.status === 'pending') {
      await markScanStatus(id, 'running');
    }

    return json({
      id,
      status: snapshot.status,
      progress: snapshot.progress,
      result: null,
      error: snapshot.error,
      unlocked,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Service indisponible (Redis ?) : ${message}` },
      { status: 503 },
    );
  }
}

function json(payload: JobStatusResponse): NextResponse {
  return NextResponse.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
