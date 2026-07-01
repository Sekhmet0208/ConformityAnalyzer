import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { getCurrentUser } from '@/lib/auth';
import LogoutButton from '@/components/LogoutButton';

export const metadata: Metadata = {
  title: 'ConformitéScan — Vérifiez la conformité de votre site',
  description:
    'Scannez votre site web et détectez en moins d\'une minute vos problèmes de conformité RGPD, cookies, accessibilité et mentions légales.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="fr">
      <body>
        <div className="app-shell">
          <header className="site-header">
            <Link className="brand" href="/">
              <span className="brand-mark" aria-hidden="true">
                ⬡
              </span>
              <span className="brand-name">
                Conformité<span className="brand-accent">Scan</span>
              </span>
            </Link>
            <nav className="site-nav">
              <a href="/#fonctionnement">Fonctionnement</a>
              <a href="/#tarifs">Tarifs</a>
              {user ? (
                <>
                  <Link href="/documents">Documents</Link>
                  <Link href="/account" className="nav-account">
                    {user.plan === 'paid' && (
                      <span className="plan-badge" title="Abonnement actif">
                        ★
                      </span>
                    )}
                    Mon compte
                  </Link>
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link href="/login">Connexion</Link>
                  <Link className="nav-cta" href="/signup">
                    Créer un compte
                  </Link>
                </>
              )}
            </nav>
          </header>
          <main className="site-main">{children}</main>
          <footer className="site-footer">
            <p>
              <strong>Avertissement.</strong> Cet outil fournit une aide
              automatisée à la mise en conformité et des documents-types. Il ne
              constitue pas un conseil juridique et ne garantit pas la
              conformité de votre site. Seule une partie des critères est
              vérifiable automatiquement.
            </p>
            <p className="footer-meta">
              © {new Date().getFullYear()} ConformitéScan · Données analysées en
              temps réel, jamais revendues.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
