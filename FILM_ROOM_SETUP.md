# Film Room cloud storage setup

The Team Hub **Film Room** (`/team/video`) works out of the box in
*local mode*: anyone can load video files from their device and review them,
but nothing is uploaded — film and clips disappear when the tab closes.

This guide turns on *team mode*: film uploads to **Cloudflare Stream**
(cheap storage + adaptive streaming, like Hudl), and the library + saved
clips are shared with everyone who signs into the Team Hub, on any device.

You do this **once**, in three short parts. No code changes needed.

---

## Part 1 — Cloudflare Stream account

1. Sign up / log in: <https://dash.cloudflare.com>
2. Left sidebar → **Stream** → subscribe (≈ $5/mo minimum: $5 per 1,000 min
   stored + $1 per 1,000 min delivered). Add a payment method.
3. Copy your **Account ID** — shown on the Stream page (right side) or in the
   URL: `dash.cloudflare.com/`**`<ACCOUNT_ID>`**`/stream`.
4. Create an **API token**: top-right profile → **My Profile → API Tokens →
   Create Token → Create Custom Token**.
   - Permissions: **Account · Stream · Edit**
   - Account Resources: your account
   - Create → **copy the token** (it's shown once).
5. Find your **customer code**: on the Stream page, any video's embed/HLS URL
   looks like `customer-`**`abcd1234`**`.cloudflarestream.com/…` — the
   `abcd1234` part. (No videos yet? Upload any short test clip in the
   Cloudflare dashboard to see it, then delete the clip.)

You now have: **Account ID**, **API token**, **customer code**.

## Part 2 — Create the database tables

Supabase Dashboard → **SQL Editor** → **New query** → paste the whole of
[`supabase/migrations/0002_film_room.sql`](supabase/migrations/0002_film_room.sql)
→ **Run**. This creates `team_videos` and `team_clips` (locked down with RLS —
only the website server can touch them).

## Part 3 — Add the environment variables

Add these three values wherever the site's env vars live — `.env.local` for
local dev, and **Vercel → Project → Settings → Environment Variables** for the
live site (then redeploy):

```
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_STREAM_API_TOKEN=your-api-token
CLOUDFLARE_STREAM_CUSTOMER_CODE=abcd1234
```

That's it. Reload the Film Room — the button now reads **Upload Film**, and
uploads show a progress bar, land in the shared team library, and stream back
with adaptive quality on any device.

---

## How it works / notes

- **Upload**: the browser asks the site server for a one-time resumable (tus)
  upload URL, then sends the file straight to Cloudflare. Big files resume if
  the connection drops. The API token never reaches the browser.
- **Who can do what**: coaches (anyone signed into `/admin`) upload film,
  delete it, and manage the shared clips — and get into the Film Room with
  their admin session, no Team Hub registration needed (there's a Film Room
  link in the admin nav). Team Hub members get watch-only access to the team
  library; they can still load their own local files and mark private
  on-device clips. Deleting a film also deletes it from Cloudflare so you
  don't pay for orphaned storage — and removes its saved clips.
- **What's stored where**: the video files live on Cloudflare; Supabase only
  holds a tiny record per film (`name` + Cloudflare id) and the clip marks.
- **Fresh uploads** take Cloudflare a minute or two to process. If a panel
  says the film is still processing, it retries automatically.
- **Privacy**: playback uses unguessable Cloudflare URLs but is not
  token-locked. Locking playback behind signed URLs is a possible later
  hardening step.
