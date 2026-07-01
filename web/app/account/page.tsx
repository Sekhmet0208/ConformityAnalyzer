import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getSubscriptionForUser } from '@/lib/billing';
import { listScansForUser } from '@/lib/scans-store';
import { isBillingDevMode } from '@/lib/billing';
import UnlockButton from '@/components/UnlockButton';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account');

  const subscription = await getSubscriptionForUser(user.id);
  const scans = await listScansForUser(user.id);
  const isPaid = user.plan === 'paid';

  return (
    <div className="account">
      <div className="account-head">
        <div>
          <h1>Mon compte</h1>
          <p className="muted">{user.email}</p>
        </div>
        <Link className="btn btn-ghost" href="/">
          + Nouveau scan
        </Link>
      </div>

      <section className="account-card">
        <div className="plan-row">
          <div>
            <div className="muted small">Abonnement</div>
            <div className="plan-name">
              {isPaid ? 'Essentiel — actif' : 'Découverte (gratuit)'}
            </div>
            {subscription?.current_period_end && isPaid && (
              <div className="muted small">
                Renouvellement le{' '}
                {new Date(subscription.current_period_end).toLocaleDateString(
                  'fr-FR',
                )}
              </div>
            )}
          </div>
          {!isPaid && (
            <div>
              <UnlockButton label="Passer à Essentiel (29 €/mois)" />
              {isBillingDevMode() && (
                <p className="muted small dev-note">
                  Mode dev : l&apos;abonnement est simulé (pas de paiement réel).
                </p>
              )}
            </div>
          )}
        </div>
        {isPaid && (
          <p className="muted small" style={{ marginTop: 14 }}>
            <Link href="/documents" className="link">
              Générer mes documents légaux →
            </Link>
          </p>
        )}
      </section>

      <h2 className="account-subtitle">Mes scans</h2>
      {scans.length === 0 ? (
        <p className="muted">
          Aucun scan pour le moment.{' '}
          <Link href="/" className="link">
            Lancer une analyse
          </Link>
          .
        </p>
      ) : (
        <div className="scan-list">
          {scans.map((s) => (
            <Link key={s.id} href={`/scan/${s.id}`} className="scan-item">
              <div className="scan-item-main">
                <span className="scan-item-url">{s.root_url}</span>
                <span className="muted small">
                  {new Date(s.created_at).toLocaleString('fr-FR')} ·{' '}
                  {s.tier === 'paid' ? 'complet' : 'gratuit'}
                </span>
              </div>
              <div className="scan-item-right">
                {s.status === 'done' ? (
                  <span className="score-pill">{s.score ?? '—'}/100</span>
                ) : (
                  <span className="muted small">{statusLabel(s.status)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'en attente';
    case 'running':
      return 'en cours';
    case 'failed':
      return 'échec';
    default:
      return status;
  }
}
