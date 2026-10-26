import { NextResponse } from 'next/server';
import { deleteTask, getTask, updateTask } from '@/lib/store';
import { fail, guard } from '@/lib/api';

export async function PATCH(request, { params }) {
  const { error } = await guard(request);
  if (error) return error;
  try {
    const { id } = await params;
    return NextResponse.json(await updateTask(id, await request.json()));
  } catch (err) {
    return fail(err);
  }
}

// Deleting: admins, or the person who added the task
export async function DELETE(request, { params }) {
  const { error, user } = await guard(request);
  if (error) return error;
  try {
    const { id } = await params;
    const task = await getTask(id);
    if (task && user.role !== 'admin' && task.created_by !== (user.email || user.name)) {
      return NextResponse.json({ error: 'Only an admin or the person who added it can delete this task.' }, { status: 403 });
    }
    await deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
