import { NextResponse } from 'next/server';
import { currentUser } from './auth';

// Shared bits for the API routes: the login check (and admin check), a same-site check on changes, and JSON errors
export async function guard(request, { admin = false } = {}) {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: 'Please sign in again.' }, { status: 401 }) };
  if (admin && user.role !== 'admin') return { error: NextResponse.json({ error: 'Only admins can do that.' }, { status: 403 }) };
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== request.headers.get('host')) return { error: NextResponse.json({ error: 'Not allowed.' }, { status: 403 }) };
  }
  return { user };
}

export const fail = (err) => NextResponse.json({ error: err?.message || 'Something went wrong.' }, { status: 400 });
