import { redirect } from 'next/navigation';
import AuthForm from '@/components/AuthForm';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function safeNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  // N'autorise que les chemins internes (evite les redirections ouvertes).
  if (value && value.startsWith('/') && !value.startsWith('//')) return value;
  return '/account';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next);
  if (await getCurrentUser()) redirect(target);

  return (
    <div className="auth-wrap">
      <AuthForm mode="login" next={target} />
    </div>
  );
}
