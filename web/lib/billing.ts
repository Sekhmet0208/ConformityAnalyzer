import 'server-only';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import { query, type SubscriptionRow, type UserRow } from './db';
import { setUserPlan } from './auth';

/**
 * Couche paiement (PRD §4 : "Stripe (abonnements + webhooks)").
 *
 * Mode reel : si STRIPE_SECRET_KEY est defini, on cree de vraies sessions
 * Checkout (mode test recommande) et on synchronise l'etat via webhooks.
 *
 * Mode dev (aucune cle Stripe) : `createCheckout` active directement un
 * abonnement simule, ce qui permet de tester tout le parcours paywall ->
 * deverrouillage sans compte Stripe (cf. README "tester gratuitement").
 */

const PLAN_LABEL = 'Essentiel';

export function isBillingDevMode(): boolean {
  return !process.env.STRIPE_SECRET_KEY;
}

let stripeSingleton: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY absent : mode dev (pas de Stripe reel).');
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

// --- Acces aux abonnements en base -----------------------------------------

export async function getSubscriptionForUser(
  userId: string,
): Promise<SubscriptionRow | undefined> {
  const res = await query<SubscriptionRow>(
    `SELECT * FROM subscriptions WHERE user_id = $1
     ORDER BY updated_at DESC LIMIT 1`,
    [userId],
  );
  return res.rows[0];
}

async function findUserIdByCustomer(
  customerId: string,
): Promise<string | undefined> {
  const res = await query<{ user_id: string }>(
    'SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1 LIMIT 1',
    [customerId],
  );
  return res.rows[0]?.user_id;
}

interface UpsertSubInput {
  userId: string;
  customerId: string | null;
  subscriptionId: string | null;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
}

/** Insere/met a jour un abonnement et synchronise le plan de l'utilisateur. */
export async function upsertSubscription(input: UpsertSubInput): Promise<void> {
  const now = new Date().toISOString();
  const existing = input.subscriptionId
    ? (
        await query<SubscriptionRow>(
          'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1',
          [input.subscriptionId],
        )
      ).rows[0]
    : undefined;

  if (existing) {
    await query(
      `UPDATE subscriptions
         SET status = $1, plan = $2, current_period_end = $3,
             stripe_customer_id = COALESCE($4, stripe_customer_id),
             updated_at = $5
       WHERE id = $6`,
      [
        input.status,
        input.plan,
        input.currentPeriodEnd,
        input.customerId,
        now,
        existing.id,
      ],
    );
  } else {
    await query(
      `INSERT INTO subscriptions
         (id, user_id, stripe_customer_id, stripe_subscription_id, plan,
          status, current_period_end, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        randomUUID(),
        input.userId,
        input.customerId,
        input.subscriptionId,
        input.plan,
        input.status,
        input.currentPeriodEnd,
        now,
        now,
      ],
    );
  }

  // Synchronise le plan denormalise sur l'utilisateur (sert au paywall).
  const active = input.status === 'active' || input.status === 'trialing';
  await setUserPlan(input.userId, active ? 'paid' : 'free');
}

// --- Creation de la session de paiement ------------------------------------

export interface CheckoutResult {
  url: string;
  devMode: boolean;
}

/**
 * Cree une session de paiement. En mode dev, active directement l'abonnement et
 * renvoie l'URL de succes. En mode reel, cree une session Stripe Checkout.
 */
export async function createCheckout(
  user: UserRow,
  origin: string,
): Promise<CheckoutResult> {
  const successUrl = `${origin}/billing/success`;
  const cancelUrl = `${origin}/#tarifs`;

  if (isBillingDevMode()) {
    // Simulation : abonnement actif immediat (test local sans Stripe).
    await upsertSubscription({
      userId: user.id,
      customerId: `dev_cus_${user.id.slice(0, 8)}`,
      subscriptionId: `dev_sub_${randomUUID().slice(0, 8)}`,
      plan: PLAN_LABEL,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
    return { url: successUrl, devMode: true };
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error('STRIPE_PRICE_ID manquant pour le mode Stripe reel.');
  }

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: user.id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId: user.id },
  });

  if (!session.url) {
    throw new Error('Stripe n\'a pas renvoye d\'URL de paiement.');
  }
  return { url: session.url, devMode: false };
}

// --- Traitement des evenements webhook -------------------------------------

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.client_reference_id ?? session.metadata?.userId;
  if (!userId) return;
  const customerId =
    typeof session.customer === 'string' ? session.customer : null;
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : null;
  await upsertSubscription({
    userId,
    customerId,
    subscriptionId,
    plan: PLAN_LABEL,
    status: 'active',
    currentPeriodEnd: null,
  });
}

export async function handleSubscriptionEvent(
  sub: Stripe.Subscription,
): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : null;
  if (!customerId) return;
  const userId = await findUserIdByCustomer(customerId);
  if (!userId) return;
  const periodEnd =
    'current_period_end' in sub && typeof sub.current_period_end === 'number'
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;
  await upsertSubscription({
    userId,
    customerId,
    subscriptionId: sub.id,
    plan: PLAN_LABEL,
    status: sub.status,
    currentPeriodEnd: periodEnd,
  });
}
