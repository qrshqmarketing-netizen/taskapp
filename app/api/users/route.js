import { NextResponse } from 'next/server';
import { fail, guard } from '@/lib/api';
import { forgetMember, toMember } from '@/lib/auth';
import { adminIds, forgetTeam, notify } from '@/lib/notify';
import { ROLES, createUser, findUserByEmail, getUser, listUsers, roleOf, sendMagicLink, setName, setTasksRole } from '@/lib/supabaseAuth';

export const dynamic = 'force-dynamic';

// The team list for the board (names for the owner picker) and the Team page
export async function GET(request) {
  const { error } = await guard(request);
  if (error) return error;
  try {
    return NextResponse.json({ users: await team() });
  } catch (err) {
    return fail(err);
  }
}

async function team() {
  return (await listUsers())
    .map((u) => ({ ...toMember(u), last_sign_in_at: u.last_sign_in_at || null, created_at: u.created_at }))
    .filter((m) => m.role)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Admins only. { action: 'invite', email, name, role } | { action: 'role', id, role } | { action: 'remove', id } | { action: 'resend', id }
export async function POST(request) {
  const { error, user: me } = await guard(request, { admin: true });
  if (error) return error;
  try {
    const body = await request.json();
    const origin = process.env.APP_URL?.replace(/\/$/, '') || new URL(request.url).origin;
    const link = (email) => sendMagicLink(email, `${origin}/auth/confirm`);
    const role = ROLES.includes(body.role) ? body.role : 'member';

    if (body.action === 'invite') {
      const email = String(body.email || '').trim().toLowerCase();
      const name = String(body.name || '').trim().slice(0, 60);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
      // Someone who already has a Supabase account (for example a website dashboard login) just gets task access added
      const existing = await findUserByEmail(email);
      if (existing) {
        await setTasksRole(existing.id, role);
        if (name && !existing.user_metadata?.name) await setName(existing.id, name);
        forgetMember(existing.id);
      } else {
        await createUser(email, name, role);
      }
      forgetTeam();
      await notify(await adminIds(), { kind: 'team', text: `${me.name} added ${name || email} to the team as ${role === 'admin' ? 'an admin' : 'a member'}`, actor: me });
      let sent = true;
      try {
        await link(email);
      } catch {
        sent = false;
      }
      return NextResponse.json({ users: await team(), message: sent ? `${email} was added and sent a sign-in link.` : `${email} was added. The email didn't go out (Supabase email limit); use "Send link" in a minute.` });
    }

    const target = body.id && (await getUser(body.id));
    if (!target || !roleOf(target)) throw new Error('That person is not on the team.');
    if (target.id === me.id && body.action !== 'resend') throw new Error('You can’t change or remove your own access. Ask another admin.');
    const admins = (await team()).filter((m) => m.role === 'admin');

    if (body.action === 'role') {
      if (roleOf(target) === 'admin' && role !== 'admin' && admins.length <= 1) throw new Error('Keep at least one admin.');
      await setTasksRole(target.id, role);
    } else if (body.action === 'remove') {
      if (roleOf(target) === 'admin' && admins.length <= 1) throw new Error('Keep at least one admin.');
      await setTasksRole(target.id, 'none'); // task access only; their Supabase account (and any website dashboard access) is untouched
    } else if (body.action === 'resend') {
      await link(target.email);
      return NextResponse.json({ users: await team(), message: `Sign-in link sent to ${target.email}.` });
    } else throw new Error('Unknown action.');

    forgetMember(target.id);
    forgetTeam();
    return NextResponse.json({ users: await team(), message: body.action === 'remove' ? `${target.email} no longer has access.` : 'Role updated.' });
  } catch (err) {
    return fail(err);
  }
}
