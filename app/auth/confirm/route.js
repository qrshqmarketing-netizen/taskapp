import { NextResponse } from 'next/server';
import { COOKIE, cookieOptions, makeSession, toMember } from '@/lib/auth';
import { verifyLink } from '@/lib/supabaseAuth';

// The magic link lands here (?token_hash=...&type=email): Supabase checks it once, and a team member gets the app's session cookie
export async function GET(request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') === 'magiclink' ? 'magiclink' : 'email';
  const back = (error) => NextResponse.redirect(new URL(error ? `/login?error=${error}` : '/', url.origin));
  if (!tokenHash) return back('link');
  try {
    const member = toMember(await verifyLink(tokenHash, type));
    if (!member) return back('access');
    const res = back('');
    res.cookies.set(COOKIE, makeSession(member), cookieOptions);
    return res;
  } catch {
    return back('link');
  }
}
