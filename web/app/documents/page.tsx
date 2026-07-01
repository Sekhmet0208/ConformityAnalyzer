import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { canGenerateDocuments } from '@/lib/entitlement';
import { tierOverrideEnabled } from '@/lib/validate';
import { listDocumentsForUser } from '@/lib/documents/store';
import { DOCUMENT_META, type DocumentType } from '@/lib/documents/types';
import UnlockButton from '@/components/UnlockButton';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/documents');

  const allowed = canGenerateDocuments(user, tierOverrideEnabled());
  const docs = await listDocumentsForUser(user.id);

  return (
    <div className="account">
      <div className="account-head">
        <div>
          <h1>Mes documents</h1>
          <p className="muted">
            Générez vos documents légaux à partir de modèles conformes.
          </p>
        </div>
        <Link className="btn btn-ghost" href="/account">
          ← Mon compte
        </Link>
      </div>

      {!allowed && (
        <div className="unlock-banner" style={{ marginBottom: 24 }}>
          <div>
            <h3>🔒 Fonctionnalité incluse dans l’offre Essentiel</h3>
            <p>
              Abonnez-vous pour générer vos mentions légales, politique de
              confidentialité, déclaration d’accessibilité et bannière cookies.
            </p>
          </div>
          <UnlockButton className="btn" label="Débloquer (29 €/mois)" />
        </div>
      )}

      <h2 className="account-subtitle">Générer un nouveau document</h2>
      <div className="doc-type-grid">
        {(Object.keys(DOCUMENT_META) as DocumentType[]).map((type) => {
          const meta = DOCUMENT_META[type];
          return (
            <Link
              key={type}
              href={allowed ? `/documents/new?type=${type}` : '/documents'}
              className={`doc-type-card${allowed ? '' : ' disabled'}`}
              aria-disabled={!allowed}
            >
              <div className="doc-ico">{meta.icon}</div>
              <div>
                <h3>{meta.label}</h3>
                <p className="muted small">{meta.description}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <h2 className="account-subtitle">Documents générés</h2>
      {docs.length === 0 ? (
        <p className="muted">Aucun document pour le moment.</p>
      ) : (
        <div className="scan-list">
          {docs.map((d) => (
            <Link key={d.id} href={`/documents/${d.id}`} className="scan-item">
              <div className="scan-item-main">
                <span className="scan-item-url">
                  {DOCUMENT_META[d.type as DocumentType]?.icon ?? '📄'}{' '}
                  {d.title}
                </span>
                <span className="muted small">
                  {new Date(d.created_at).toLocaleString('fr-FR')}
                </span>
              </div>
              <span className="link small">Ouvrir →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
