import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
  handleCheckoutCompleted,
  handleSubscriptionEvent,
  isBillingDevMode,
  stripe,
} from '@/lib/billing';

export const runtime = 'nodejs';

/**
 * POST /api/stripe/webhook
 * Recoit les evenements Stripe (abonnements) et synchronise l'etat du compte.
 * La signature est verifiee via STRIPE_WEBHOOK_SECRET (securite : on ne fait
 * jamais confiance au corps brut sans verification).
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (isBillingDevMode()) {
    // En mode dev, l'activation se fait directement au checkout : pas de webhook.
    return NextResponse.json({ received: true, devMode: true });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'STRIPE_WEBHOOK_SECRET non configure.' },
      { status: 500 },
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Signature manquante.' }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Signature invalide : ${message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      default:
        // Evenements non geres : on accuse reception sans rien faire.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Traitement webhook en echec : ${message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
