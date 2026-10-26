import { NextResponse } from 'next/server';
import { authEnabled, bootstrapAdmins, createUser, findUserByEmail, roleOf, sendMagicLink, setTasksRole } from '@/lib/supabaseAuth';

// "Email me a sign-in link". Only team members (tasks_role admin or member) get one; an email in TASKS_ADMIN_EMAILS is made an admin first.
// The answer is the same whether or not the email is on the team, so nobody can test which addresses have access.
const tries = new Map();
const SAME = { ok: true, message: 'If this email is on the team, a sign-in link is on its way. It works once and expires in an hour.' };

export async function POST(request) {
  if (!authEnabled) return NextResponse.json({ error: 'Supabase sign-in is not set up yet (see the README).' }, { status: 503 });
  const ip = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const now = Date.now();
  const recent = (tries.get(ip) || []).filter((t) => now - t < 600000);
  if (recent.length >= 6) return NextResponse.json({ error: 'Too many requests. Wait a few minutes.' }, { status: 429 });
  tries.set(ip, [...recent, now]);

  const { email: raw = '' } = await request.json().catch(() => ({}));
  const email = String(raw).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });

  try {
    let user = await findUserByEmail(email);
    if (bootstrapAdmins().includes(email)) {
      if (!user) user = await createUser(email, '', 'admin');
      else if (roleOf(user) !== 'admin') await setTasksRole(user.id, 'admin');
    } else if (!user || !roleOf(user)) {
      return NextResponse.json(SAME);
    }
    const origin = process.env.APP_URL?.replace(/\/$/, '') || new URL(request.url).origin;
    await sendMagicLink(email, `${origin}/auth/confirm`);
    return NextResponse.json(SAME);
  } catch (err) {
    const limited = err.status === 429;
    return NextResponse.json({ error: limited ? 'Supabase is limiting sign-in emails right now. Wait a minute and try again.' : `Could not send the link: ${err.message}` }, { status: limited ? 429 : 502 });
  }
}
