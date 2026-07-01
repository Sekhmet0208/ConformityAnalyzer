import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createCheckout } from '@/lib/billing';

export const runtime = 'nodejs';

/**
 * POST /api/billing/checkout
 * Demarre un abonnement pour l'utilisateur connecte. En mode dev (sans cle
 * Stripe), active directement l'abonnement simule. Renvoie l'URL de redirection.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Vous devez etre connecte pour vous abonner.' },
      { status: 401 },
    );
  }

  const origin = new URL(request.url).origin;
  try {
    const { url, devMode } = await createCheckout(user, origin);
    return NextResponse.json({ url, devMode });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Echec de la creation du paiement : ${message}` },
      { status: 500 },
    );
  }
}
