import ScanView from '@/components/ScanView';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  return (
    <ScanView
      id={id}
      loggedIn={!!user}
      hasPlan={user?.plan === 'paid'}
    />
  );
}
