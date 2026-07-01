'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Props {
  mode: 'login' | 'signup';
  next: string;
}

export default function AuthForm({ mode, next }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.');
        setSubmitting(false);
        return;
      }
      // Rafraichit l'etat serveur (header, droits) puis redirige.
      router.push(next);
      router.refresh();
    } catch {
      setError('Impossible de contacter le serveur. Réessayez.');
      setSubmitting(false);
    }
  }

  const otherHref = `/${isSignup ? 'login' : 'signup'}${
    next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''
  }`;

  return (
    <div className="auth-card">
      <h1>{isSignup ? 'Créer un compte' : 'Connexion'}</h1>
      <p className="auth-sub">
        {isSignup
          ? 'Débloquez le détail de vos rapports et générez vos documents.'
          : 'Accédez à vos scans et à votre abonnement.'}
      </p>

      <form onSubmit={onSubmit} className="auth-form">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        </label>
        <label className="field">
          <span>Mot de passe</span>
          <input
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
          {isSignup && (
            <small className="hint">8 caractères minimum.</small>
          )}
        </label>

        {error && <div className="form-error">{error}</div>}

        <button className="btn btn-primary auth-submit" disabled={submitting}>
          {submitting
            ? 'Veuillez patienter…'
            : isSignup
              ? 'Créer mon compte'
              : 'Se connecter'}
        </button>
      </form>

      <p className="auth-switch">
        {isSignup ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
        <Link href={otherHref}>
          {isSignup ? 'Se connecter' : 'Créer un compte'}
        </Link>
      </p>
    </div>
  );
}
