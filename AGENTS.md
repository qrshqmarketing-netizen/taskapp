# This is NOT the Next.js you know

This app uses Next.js 16 (App Router, JavaScript, plain CSS). APIs and conventions differ from older versions: read the guide in `node_modules/next/dist/docs/` before writing code (Middleware is now `proxy.js`; route `params` and `cookies()` are async).

## Project notes

- QRS Tasks: the marketing team's board (README.md). Areas, statuses, repeats and starter tasks: `lib/areas.js`. Storage: `lib/store.js` (Supabase table `team_tasks` from `scripts/supabase-tasks.sql` when `SUPABASE_URL` + `SUPABASE_SECRET_KEY` are set, else `data/tasks.local.json`). Login: `lib/auth.js` (shared `TEAM_PASSWORD`, signed cookie; no password locally when it is unset, locked on Vercel when it is unset). API: `app/api/tasks` (GET, POST one or many), `app/api/tasks/[id]` (PATCH, DELETE; a repeating task marked done creates its next copy), `app/api/login`, `app/api/logout`. UI: `components/TaskApp.jsx` (tabs, counts, toolbar, Board and List), `Calendar.jsx` (month grid, drag to reschedule, "No date yet" tray), `TaskDialog.jsx`, `shared.jsx` (cards, dates).
- Keys only in `.env.local` and Vercel.
