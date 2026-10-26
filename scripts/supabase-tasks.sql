-- The team task board's tables (the QRS task app saves its tasks, comments and notifications here when SUPABASE_URL and SUPABASE_SECRET_KEY are set).
-- Run this once: Supabase dashboard -> SQL Editor -> New query -> paste this whole file -> Run. It is safe to run again.
-- It can live in the same Supabase project as the website: its own tables, team_tasks, team_task_comments and team_notifications.
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
  created_by text not null default '',          -- email of the person who added it (who may delete it besides admins)
  created_by_id uuid,                            -- their Supabase user id (for notifications)
  assignee_id uuid,                              -- the team member it is assigned to (owner holds their name for display)
  disposition text not null default '',          -- how it ended: completed, published, sent, fixed, rescheduled, not_needed, cancelled, blocked
  disposition_note text not null default ''
);

-- For a table made by an earlier version of this script
alter table public.team_tasks add column if not exists created_by_id uuid;
alter table public.team_tasks add column if not exists assignee_id uuid;
alter table public.team_tasks add column if not exists disposition text not null default '';
alter table public.team_tasks add column if not exists disposition_note text not null default '';

-- The board loads open work by status and due date, and the calendar by due date
create index if not exists team_tasks_due_idx on public.team_tasks (due);
create index if not exists team_tasks_status_due_idx on public.team_tasks (status, due);
create index if not exists team_tasks_assignee_idx on public.team_tasks (assignee_id);

-- Comments on a task (deleted with it)
create table if not exists public.team_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.team_tasks (id) on delete cascade,
  author_id uuid,
  author_name text not null default '',
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_task_comments_task_idx on public.team_task_comments (task_id, created_at);

-- In-app notifications, one row per person (the bell); read_at is set when they've seen it
create table if not exists public.team_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null default '',                 -- assigned, comment, review, done, team
  text text not null default '',
  task_id uuid references public.team_tasks (id) on delete cascade,
  actor_name text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists team_notifications_user_idx on public.team_notifications (user_id, created_at desc);
create index if not exists team_notifications_unread_idx on public.team_notifications (user_id) where read_at is null;

-- Only the app's server (with the secret key, which bypasses RLS) may read or write. RLS on with no policies, and no grants for the public
-- roles, means the publishable/anon key and signed-in Supabase users can't see these rows. (Roles and who sees which notification are
-- enforced by the app's server, which checks the signed-in person on every request.)
alter table public.team_tasks enable row level security;
alter table public.team_task_comments enable row level security;
alter table public.team_notifications enable row level security;
revoke all on public.team_tasks, public.team_task_comments, public.team_notifications from anon, authenticated;
