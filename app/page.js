import { redirect } from 'next/navigation';
import TaskApp from '@/components/TaskApp';
import { currentUser } from '@/lib/auth';
import { listTasks, storageName } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect('/login');
  let tasks = [];
  let loadError = '';
  try {
    tasks = await listTasks();
  } catch (err) {
    loadError = err.message;
  }
  return <TaskApp initialTasks={tasks} loadError={loadError} storage={storageName} user={user} />;
}
