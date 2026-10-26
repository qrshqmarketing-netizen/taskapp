import { redirect } from 'next/navigation';
import TeamManager from '@/components/TeamManager';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team · QRS Tasks' };

export default async function Users() {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/');
  return <TeamManager me={user} />;
}
