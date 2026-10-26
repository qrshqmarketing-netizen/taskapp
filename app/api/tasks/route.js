import { NextResponse } from 'next/server';
import { createTasks, listTasks } from '@/lib/store';
import { fail, guard } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { error } = await guard(request);
  if (error) return error;
  try {
    return NextResponse.json({ tasks: await listTasks() });
  } catch (err) {
    return fail(err);
  }
}

// One task ({ task }) or several at once ({ tasks: [...] }, the starter tasks)
export async function POST(request) {
  const { error, user } = await guard(request);
  if (error) return error;
  try {
    const body = await request.json();
    const list = Array.isArray(body.tasks) ? body.tasks.slice(0, 50) : [body.task || body];
    return NextResponse.json({ tasks: await createTasks(list, user.email || user.name) });
  } catch (err) {
    return fail(err);
  }
}
