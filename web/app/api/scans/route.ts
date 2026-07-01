import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { enqueueScan } from '@/lib/queue';
import { normalizeAndValidateUrl, tierOverrideEnabled } from '@/lib/validate';
import { ANON_COOKIE, getCurrentUser } from '@/lib/auth';
import { resolveScanTier } from '@/lib/entitlement';
import { createScanRow } from '@/lib/scans-store';
import { ensureAnonCookie } from '@/lib/session-cookies';

export const runtime = 'nodejs';

/**
 * POST /api/scans  { url, tier? }
 * Cree un scan : resout le palier selon les droits (abonnement ou override dev),
 * enfile le job, persiste la ligne de scan et renvoie son identifiant public.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  const { url, tier: requestedTier } = (body ?? {}) as {
    url?: string;
    tier?: string;
  };

  if (typeof url !== 'string') {
    return NextResponse.json(
      { error: "Le champ 'url' est requis." },
      { status: 400 },
    );
  }

  const normalized = normalizeAndValidateUrl(url);
  if (!normalized) {
    return NextResponse.json(
      { error: 'URL invalide. Saisissez une adresse de site valide.' },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  const { tier, devUnlocked } = resolveScanTier(
    user,
    requestedTier,
    tierOverrideEnabled(),
  );

  try {
    const jobId = await enqueueScan({ url: normalized, tier });

    const existingAnon = (await cookies()).get(ANON_COOKIE)?.value ?? null;
    // Reponse intermediaire pour, au besoin, generer/poser un cookie anonyme.
    const cookieHolder = NextResponse.json(null);
    const anonId = user ? null : ensureAnonCookie(cookieHolder, existingAnon);

    const scanId = await createScanRow({
      userId: user?.id ?? null,
      anonId,
      jobId,
      rootUrl: normalized,
      tier,
      devUnlocked,
    });

    const res = NextResponse.json(
      { id: scanId, url: normalized, tier },
      { status: 202 },
    );
    for (const c of cookieHolder.cookies.getAll()) {
      res.cookies.set(c);
    }
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Cas le plus courant : Redis non demarre.
    return NextResponse.json(
      {
        error:
          "Impossible de mettre le scan en file. Le service de file (Redis) " +
          'est-il demarre ? ' +
          message,
      },
      { status: 503 },
    );
  }
}
