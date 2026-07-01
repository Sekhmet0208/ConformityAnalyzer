import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function BillingSuccessPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isPaid = user.plan === 'paid';

  return (
    <div className="success-wrap">
      <div className="success-card">
        <div className="success-mark" aria-hidden="true">
          ✓
        </div>
        <h1>{isPaid ? 'Abonnement actif !' : 'Paiement en cours de validation'}</h1>
        <p className="muted">
          {isPaid
            ? 'Le détail de vos rapports et la génération de documents sont désormais débloqués.'
            : "Votre paiement est en cours de traitement. Vos droits seront actifs dès confirmation."}
        </p>
        <div className="success-actions">
          <Link className="btn btn-primary" href="/account">
            Voir mon compte
          </Link>
          <Link className="btn btn-ghost" href="/">
            Nouveau scan
          </Link>
        </div>
      </div>
    </div>
  );
}
