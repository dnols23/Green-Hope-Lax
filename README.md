# 🦅 Green Hope Falcons Lacrosse

Official website for the Green Hope High School Falcons lacrosse program — Cary, NC.
Built with **Next.js (App Router) + TypeScript**, **Tailwind CSS**, **Supabase**,
and deployed on **Vercel**.

- Public site: Home, Schedule & Results, Roster, Coaches, News, Resources
- **Join the Team** interest form + general Contact form → saved to Supabase,
  emailed to the coach, exportable to CSV (and optionally synced to Google Sheets)
- Password-protected **/admin** to manage everything

> **Nothing is configured yet** — follow the steps below in order. Each step is a
> separate, do-once task. Budget ~30–45 minutes for first-time setup.

---

## What you need

- A computer with **Node.js 20+** (`node --version` to check)
- A free **Supabase** account → https://supabase.com
- A free **Vercel** account → https://vercel.com
- A **GitHub** account (to push the code and connect Vercel)
- *(Optional)* a **Resend** account for email → https://resend.com
- *(Optional)* a **Google Cloud** account for Sheets sync

---

## Step 1 — Run it locally

```bash
cd green-hope-falcons
npm install
cp .env.example .env.local      # then fill in values from Step 2
npm run dev
```

Open http://localhost:3000. It runs before Supabase is wired up, but data pages
will be empty and forms won't save until Step 2 is done.

---

## Step 2 — Create the Supabase project & database

1. Go to https://supabase.com → **New project**. Pick a name (e.g. `green-hope-lacrosse`),
   a strong database password, and the region closest to NC (`East US`).
2. Wait for it to provision (~2 min).
3. Left sidebar → **SQL Editor** → **New query**. Open
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
   copy the whole file, paste it in, and click **Run**. This creates all tables
   and Row Level Security policies.
4. New query again → open [`supabase/seed.sql`](supabase/seed.sql), paste, **Run**.
   This fills in sample games, roster, coaches, and news so the site looks alive.
5. Left sidebar → **Project Settings → API**. Copy these into `.env.local`:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (click reveal) → `SUPABASE_SERVICE_ROLE_KEY`
     ⚠️ The service role key is secret — never expose it in client code or commit it.

Restart `npm run dev`. The schedule, roster, news, etc. should now show the seed data.

### Create your admin login
1. Supabase → **Authentication → Users → Add user → Create new user**.
2. Enter your email + a password, and check **Auto Confirm User**.
3. That's your `/admin` login. (Any confirmed Supabase user can access admin —
   only create accounts for trusted coaches/staff.)

Visit http://localhost:3000/admin and sign in.

---

## Step 3 — Email notifications (optional but recommended)

So you get an email whenever someone submits the interest or contact form.

1. Create a free account at https://resend.com.
2. **Add a domain** (e.g. `greenhopelacrosse.com`) and add the DNS records Resend
   gives you. *(For quick testing you can skip this and send from
   `onboarding@resend.dev` to your own email.)*
3. **API Keys → Create API Key**. Copy it.
4. Fill in `.env.local`:
   ```
   RESEND_API_KEY=re_xxxxxxxx
   EMAIL_FROM=Green Hope Falcons <noreply@greenhopelacrosse.com>
   COACH_NOTIFY_EMAIL=you@example.com         # comma-separate for multiple
   ```
   If `RESEND_API_KEY` is blank the site still works — it just skips the email.

---

## Step 4 — Getting submissions into a spreadsheet

You have **two options**. The CSV export works immediately with zero extra setup;
the Google Sheets sync is the "live" option if you want it.

### Option A — CSV export (built-in, recommended to start)
Sign in to **/admin → Submissions**. Each table has an **Export CSV** button that
downloads everything (interest forms and contact messages separately). Open the
file in Google Sheets / Excel. Done.

### Option B — Live Google Sheets sync (Edge Function)
Appends every new submission to a Google Sheet automatically.

1. **Make the sheet**: create a Google Sheet, add a header row, and grab its ID
   from the URL: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.
2. **Service account**: in https://console.cloud.google.com → create a project →
   enable the **Google Sheets API** → **Create credentials → Service account** →
   create a **JSON key**. From the JSON, note `client_email` and `private_key`.
3. **Share** the Google Sheet with that `client_email` as an **Editor**.
4. **Deploy the function** (needs the Supabase CLI — `npm i -g supabase`):
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy sync-to-sheets
   supabase secrets set \
     GOOGLE_SHEET_ID="..." \
     GOOGLE_SERVICE_ACCOUNT_EMAIL="...@...iam.gserviceaccount.com" \
     GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
5. **Trigger it**: Supabase → **Database → Webhooks → Create a new hook**.
   - Table: `interest_form_submissions`, Events: **Insert**
   - Type: **Supabase Edge Functions** → `sync-to-sheets`
   - Repeat for `contact_submissions` if you want those too.

New submissions now append to your sheet. (Function code:
[`supabase/functions/sync-to-sheets/index.ts`](supabase/functions/sync-to-sheets/index.ts).)

---

## Step 5 — Deploy to Vercel

1. Push this folder to a new GitHub repo:
   ```bash
   git init && git add . && git commit -m "Initial Falcons site"
   git branch -M main
   git remote add origin https://github.com/<you>/green-hope-falcons.git
   git push -u origin main
   ```
2. https://vercel.com → **Add New → Project** → import the repo. Framework
   auto-detects as **Next.js**.
3. **Environment Variables** — add every variable from `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, and any email vars). Also set
   `NEXT_PUBLIC_SITE_URL` to your real URL.
4. **Deploy.** When it's live, optionally add your custom domain in
   Vercel → **Settings → Domains** (you can point your GoDaddy domain here).

---

## Adding your real logos

The site ships with placeholder SVG logos so it looks finished immediately.
To use the official art, add `falcon-head.png`, `badge-light.png`, and
`badge-dark.png` to [`public/logos/`](public/logos) (see that folder's README),
then replace the bodies of the components in
[`src/components/Logo.tsx`](src/components/Logo.tsx) with:

```tsx
import Image from 'next/image'

export function FalconHead({ size = 40, className = '' }) {
  return <Image src="/logos/falcon-head.png" alt="Green Hope Falcons"
    width={size} height={size} priority className={className} />
}

export function FalconBadge({ size = 96, variant = 'light', className = '' }) {
  return <Image src={variant === 'light' ? '/logos/badge-light.png' : '/logos/badge-dark.png'}
    alt="Green Hope Falcons Lacrosse" width={size} height={size} className={className} />
}
```

For the favicon, replace `src/app/icon.svg` with a 512×512 `src/app/icon.png`.
Optimize PNGs at https://squoosh.app before adding them.

---

## Editing content (no code)

Everything below is editable at **/admin** once you're signed in:

| Admin page    | Manages                                            |
|---------------|----------------------------------------------------|
| Dashboard     | At-a-glance counts                                 |
| Submissions   | Interest + contact forms, **CSV export**           |
| Schedule      | Add/edit/delete games & scores (boys + girls)      |
| Roster        | Players (Boys Varsity / Boys JV / Girls)           |
| Coaches       | Coaching staff & bios                              |
| News          | Announcements (drafts supported)                   |

---

## Project structure

```
src/
  app/
    (site)/            ← public pages (Nav + Footer)
      page.tsx           Home
      schedule/ roster/ coaches/ news/ resources/ join/ contact/
    admin/
      login/             sign-in (full-screen)
      (panel)/           authed admin pages (admin chrome)
    layout.tsx           root <html>/<body>
    icon.svg             favicon
  components/          Nav, Footer, Logo, forms, cards, admin widgets
  lib/                 supabase clients, types, queries, server actions, email
  proxy.ts             auth guard for /admin (Next 16's "middleware")
supabase/
  migrations/0001_init.sql   tables + RLS
  seed.sql                   sample data
  functions/sync-to-sheets/  optional Google Sheets sync
```

## Brand colors

Forest green `#00693E` · Maroon `#7A1F2B` (defined in
[`src/app/globals.css`](src/app/globals.css) and
[`src/lib/brand.ts`](src/lib/brand.ts)). Sample the final exact hex from the
official logo files and update those two spots if needed.

## Tech notes / known limitations

- **Auth model is simple by design**: any confirmed Supabase user is an admin.
  Only create accounts for staff. (Add a role check later if you need tiers.)
- **Photo uploads**: roster/coach/news images are added by pasting an image URL.
  To host images, use Supabase **Storage** (create a public bucket, upload, paste
  the public URL). `next.config.ts` already allows `*.supabase.co` images.
- The Google Sheets Edge Function is optional and needs the setup in Step 4B.

Go Falcons! 🥍
