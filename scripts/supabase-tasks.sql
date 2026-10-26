-- The team task board's table (the QRS task app saves every task here when SUPABASE_URL and SUPABASE_SECRET_KEY are set).
-- Run this once: Supabase dashboard -> SQL Editor -> New query -> paste this whole file -> Run. It is safe to run again.
-- It can live in the same Supabase project as the website: it is its own table, `team_tasks`.
--
-- Then set in Vercel (Settings -> Environment Variables) and redeploy:
--   SUPABASE_URL          the project URL, like https://abcdefgh.supabase.co
--   SUPABASE_SECRET_KEY   a SECRET key (sb_secret_...), never the publishable / anon key. It only goes in Vercel and .env.local.

create table if not exists public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz,
  title text not null check (length(title) between 1 and 200),
  area text not null default 'website' check (area in ('website', 'facebook', 'gbp', 'offpage', 'content')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  owner text not null default '',
  due date,
  repeat text not null default '' check (repeat in ('', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
  link text not null default '',
  notes text not null default '',
  created_by text not null default ''
);

-- The board loads open work by status and due date, and the calendar by due date
create index if not exists team_tasks_due_idx on public.team_tasks (due);
create index if not exists team_tasks_status_due_idx on public.team_tasks (status, due);

-- Only the app's server (with the secret key, which bypasses RLS) may read or write. RLS on with no policies, and no grants for the public
-- roles, means the publishable/anon key and signed-in Supabase users can't see these rows.
alter table public.team_tasks enable row level security;
revoke all on public.team_tasks from anon, authenticated;
