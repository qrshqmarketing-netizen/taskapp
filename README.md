# QRS Tasks

The team board for running Quality Roofing Specialists' marketing: the **website**, **Facebook Pages**, **Google Business Profile**, **off-page SEO** and **content**, with a built-in **content calendar**. Team members sign in with a **magic link** (no passwords); **admins** manage the team.

- **Board** (To do, In progress, Waiting / review, Done; drag cards between columns), **List** (by due date, tick to finish) and **Calendar** (a month of tasks by due/publish date; drag to reschedule, click a day to plan something on it).
- **Content calendar** tab: content, Facebook and GBP on the calendar together.
- Each task has an area, owner, due/publish date, priority, link and notes, and can **repeat** (daily, weekly, every 2 weeks, monthly, every 3 months): marking a repeating task Done adds the next one.
- **Add starter tasks** fills an empty area with a routine (`lib/areas.js`, edit freely).
- **Roles:** admins add people, change roles, send sign-in links, remove access (the Team page) and can delete any task; members add, edit and move tasks and delete the ones they added.

## Run it on your computer

```bash
npm install
npm run dev
```

Open http://localhost:3300. With no `.env.local` the board opens without sign-in (as a local admin) and saves to `data/tasks.local.json`, this computer only. To use the shared board and magic links locally, copy `.env.example` to `.env.local` and fill it in (step 6 below adds `http://localhost:3300/**` to Supabase's redirect list).

## Connect Supabase (shared tasks, magic links, roles)

The app can use the website's Supabase project. Its team role is stored as `tasks_role` in each person's app_metadata, separate from the website dashboard's `role`, so task access never gives website dashboard access (or the other way round).

1. **Create the table.** Supabase dashboard → **SQL Editor** → New query → paste `scripts/supabase-tasks.sql` → **Run**. This makes `team_tasks`, with row level security on and no public access (only the app's server, with the secret key, can read it).
2. **Copy the keys.** Dashboard → **Project Settings → API Keys**: a **publishable** key (`sb_publishable_…`) and a **secret** key (`sb_secret_…`). The project URL is under **Connect** (like `https://abcdefgh.supabase.co`).
3. **Set up email sending (important).** Supabase's built-in email service only sends a few emails an hour and only to your own team's addresses, which is not enough for sign-in links. Dashboard → **Authentication → Emails → SMTP Settings** → enable custom SMTP. With Resend (the website already uses it): host `smtp.resend.com`, port `465`, user `resend`, password = a Resend API key, sender e.g. `tasks@qualityroofingspecialists.com` (a domain verified in Resend), sender name `QRS Tasks`.
4. **Change the Magic Link email.** Dashboard → **Authentication → Emails → Templates → Magic Link**. Replace the link so it goes to the task app (not the website) and carries a one-time token the app checks on its server:
   ```html
   <h2>Sign in to QRS Tasks</h2>
   <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
   <p>This link works once and expires in an hour. If you didn't ask for it, ignore this email.</p>
   ```
   The website itself doesn't use magic links, so this template only affects the task app.
5. **Turn on email sign-in.** Dashboard → **Authentication → Sign In / Providers → Email**: enabled. (New sign-ups can stay off: the app only sends links to people an admin has added.)
6. **Allow the app's address.** Dashboard → **Authentication → URL Configuration → Redirect URLs** → add:
   - `https://YOUR-TASKAPP.vercel.app/**` (and your own domain if you add one, e.g. `https://tasks.qualityroofingspecialists.com/**`)
   - `http://localhost:3300/**` (for testing on your computer)

   Leave the **Site URL** as the website. If the app's address is missing here, Supabase sends people to the website instead.
7. **Vercel environment variables** (Project → Settings → Environment Variables, Production), then **Redeploy**:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
   | `SUPABASE_SECRET_KEY` | `sb_secret_…` (server only) |
   | `SESSION_SECRET` | long random text: `openssl rand -hex 32` |
   | `TASKS_ADMIN_EMAILS` | the first admin(s), comma-separated, e.g. `marketing@qualityroofingspecialists.com` |
   | `APP_URL` | optional: the app's address, e.g. `https://tasks.qualityroofingspecialists.com` |

8. **First sign-in.** Open the app, enter an email from `TASKS_ADMIN_EMAILS` and click the link in the email. That person is made an admin automatically.
9. **Add the team.** **Team** (top right, admins only) → **Add a person**: email, name, Member or Admin. They get a sign-in link at once; later they just enter their email on the sign-in page. Change a role or **Remove** access there any time; it applies within a minute. Removing someone only takes away task access: their Supabase account (and any website dashboard login) stays.

## Deploy to Vercel

Import the GitHub repo in Vercel (New Project, framework Next.js, no build settings to change), add the environment variables above and deploy. Without Supabase settings the deployed app stays locked (it never opens to the public by accident).

## Notes

- Sessions: after the magic link is checked (`app/auth/confirm`), the app sets its own signed cookie for 30 days; every request re-reads the person's role from Supabase (cached for a minute).
- Only people on the team can request a link, and the sign-in page gives the same answer for any email, so it can't be used to find out who has access.
- The board is never indexed (`noindex` header and meta tag). Keys stay in Vercel and `.env.local` only, never in the code.
