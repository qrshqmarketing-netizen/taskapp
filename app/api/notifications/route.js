import { NextResponse } from 'next/server';
import { fail, guard } from '@/lib/api';
import { markRead, myNotifications } from '@/lib/notify';

export const dynamic = 'force-dynamic';

// The signed-in person's own notifications (newest 50); POST { ids: [...] } or { all: true } marks them read
export async function GET(request) {
  const { error, user } = await guard(request);
  if (error) return error;
  if (user.local) return NextResponse.json({ notifications: [] });
  try {
    return NextResponse.json({ notifications: await myNotifications(user.id) });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request) {
  const { error, user } = await guard(request);
  if (error) return error;
  if (user.local) return NextResponse.json({ ok: true });
  try {
    const body = await request.json();
    await markRead(user.id, body.all ? 'all' : Array.isArray(body.ids) ? body.ids : []);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
