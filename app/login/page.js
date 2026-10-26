import { redirect } from 'next/navigation';
import LoginForm from '@/components/LoginForm';
import { currentUser } from '@/lib/auth';
import { authEnabled } from '@/lib/supabaseAuth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in · QRS Tasks' };

const ERRORS = {
  link: 'That sign-in link didn’t work. Links work once and expire after an hour: ask for a new one below.',
  access: 'This email isn’t on the team yet. Ask an admin to add you.',
};

export default async function Login({ searchParams }) {
  if (await currentUser()) redirect('/');
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="login-card">
        <p className="brand">
          <span className="brand-mark" aria-hidden="true">Q</span> QRS Tasks
        </p>
        <h1>Sign in</h1>
        <p className="muted">Enter your work email and we’ll send you a one-time sign-in link. No password needed.</p>
        {ERRORS[error] && (
          <p className="error" role="alert">
            {ERRORS[error]}
          </p>
        )}
        {authEnabled ? <LoginForm /> : <p className="error">Sign-in isn’t set up yet: add the Supabase settings in Vercel (see the README).</p>}
      </div>
    </main>
  );
}
