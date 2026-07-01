'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  label?: string;
  className?: string;
}

/**
 * Declenche l'abonnement (paywall). En mode dev, l'API active directement le
 * plan et renvoie l'URL de succes ; en mode reel, elle renvoie l'URL Stripe
 * Checkout. Dans les deux cas on suit l'URL renvoyee.
 */
export default function UnlockButton({
  label = "S'abonner (29 €/mois)",
  className = 'btn btn-primary',
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      if (res.status === 401) {
        router.push('/login?next=/account');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Échec du paiement.');
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Impossible de contacter le serveur.');
      setLoading(false);
    }
  }

  return (
    <span className="unlock-action">
      <button className={className} onClick={onClick} disabled={loading}>
        {loading ? 'Redirection…' : label}
      </button>
      {error && <span className="inline-error">{error}</span>}
    </span>
  );
}
