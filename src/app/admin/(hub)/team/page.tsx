import { getTeamPosts } from '@/lib/queries'
import { createServiceClient } from '@/lib/supabase-server'
import { decryptTeamCode } from '@/lib/teamCode'
import { upsertTeamPost, deleteTeamPost, setTeamPassword } from '@/lib/actions'
import { TeamCodePanel } from '@/components/admin/TeamCodePanel'
import { DeleteButton } from '@/components/admin/DeleteButton'
import { PublishToggle } from '@/components/admin/PublishToggle'
import { TEAM_CATEGORY_META, type TeamPost, type TeamPostCategory } from '@/lib/types'
import { formatShortDate } from '@/lib/format'
import { PasswordField } from '@/components/PasswordField'
import { requireSection } from '@/lib/permissions'

export const metadata = { title: 'Team Hub' }
export const dynamic = 'force-dynamic'

const CATEGORIES = Object.keys(TEAM_CATEGORY_META) as TeamPostCategory[]

function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function PostFields({ p }: { p?: TeamPost }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="field-label">Title *</label>
        <input name="title" required defaultValue={p?.title ?? ''} className="field" />
      </div>
      <div>
        <label className="field-label">Message *</label>
        <textarea name="body" rows={4} defaultValue={p?.body ?? ''} className="field" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="field-label">Category *</label>
          <select name="category" defaultValue={p?.category ?? 'announcement'} className="field">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{TEAM_CATEGORY_META[c].emoji} {TEAM_CATEGORY_META[c].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Event date &amp; time (optional)</label>
          <input type="datetime-local" name="event_date" defaultValue={toLocalInput(p?.event_date ?? null)} className="field" />
        </div>
        <div>
          <label className="field-label">Pin to top?</label>
          <select name="pinned" defaultValue={String(p?.pinned ?? false)} className="field">
            <option value="false">No</option>
            <option value="true">Yes — pinned</option>
          </select>
        </div>
        <div>
          <label className="field-label">Published?</label>
          <select name="published" defaultValue={String(p?.published ?? true)} className="field">
            <option value="true">Published — the team sees it</option>
            <option value="false">Draft — only coaches see it</option>
          </select>
        </div>
      </div>
      <details className="rounded-lg border border-gray-200 px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-gray-600">
          Attachments &amp; byline
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <label className="field-label">Links — one per line as “Label | https://link”</label>
            <textarea name="attachments" rows={2} defaultValue={p?.attachments ?? ''} className="field"
              placeholder="Physical Form | https://example.com/form.pdf" />
          </div>
          <div>
            <label className="field-label">Posted by</label>
            <input name="author" defaultValue={p?.author ?? 'Coach'} className="field" />
          </div>
        </div>
      </details>
    </div>
  )
}

export default async function AdminTeamPage() {
  await requireSection('team')
  const posts = await getTeamPosts(true) // include drafts
  const live = posts.filter((p) => p.published).length

  // The join code, for the instructions a coach sends families. Null until the
  // password is next set — earlier ones were only ever stored as a hash.
  const svc = createServiceClient()
  const { data: codeRow } = await svc
    .from('app_settings')
    .select('value')
    .eq('key', 'team_code_enc')
    .maybeSingle()
  const teamCode = await decryptTeamCode(codeRow?.value as string | undefined)
  const joinUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://greenhopelacrosse.com'}/team/login`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black mb-1">Team Hub editor</h1>
        <p className="text-gray-500 text-sm">
          The board in your locker room. You write it here, the team reads it at{' '}
          <a href="/team" target="_blank" className="text-[var(--gh-green)] font-semibold">/team ↗</a>.
        </p>
      </div>

      {/* Who can read this — the question a coach should never have to guess at. */}
      <div className="rounded-xl border border-[var(--gh-green)]/30 bg-[var(--gh-green)]/5 p-4 text-sm">
        <p className="font-bold text-[var(--gh-green)] mb-1">🔒 Private — not on the public site</p>
        <p className="text-gray-600">
          Only people who sign in with the team password, players who followed their own invite
          link, and signed-in coaches can read these posts. Nothing here ever reaches the public
          news feed or shows up in a search — that feed is written separately under{' '}
          <strong>News</strong>.
        </p>
      </div>

      {/* Post */}
      <section className="card p-5">
        <h2 className="font-bold text-gray-700 mb-4">New post</h2>
        <form action={upsertTeamPost} className="space-y-4">
          <PostFields />
          <button type="submit" className="btn btn-primary">Post to the team</button>
        </form>
      </section>

      {/* The feed as the team sees it */}
      <section>
        <h2 className="font-bold text-gray-700 mb-1">
          The feed <span className="font-normal text-gray-400 text-sm">
            — {live} live{posts.length - live > 0 && `, ${posts.length - live} draft`}
          </span>
        </h2>
        <p className="text-xs text-gray-400 mb-3">Tap a post to edit it.</p>
        <div className="space-y-2">
          {posts.length === 0 && (
            <p className="card p-5 text-sm text-gray-500">
              Nothing posted yet. The first thing your team sees when they sign in is whatever you
              write above.
            </p>
          )}
          {posts.map((p) => (
            <details key={p.id} className="card p-4">
              <summary className="flex items-center justify-between cursor-pointer list-none gap-3">
                <span className="font-semibold">
                  {p.pinned && '📌 '}
                  {TEAM_CATEGORY_META[p.category].emoji} {p.title}
                  <span className="ml-2 text-xs text-gray-400">
                    {formatShortDate(p.created_at)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <PublishToggle entity="teampost" id={p.id} live={p.published} />
                  <DeleteButton id={p.id} action={deleteTeamPost} />
                </span>
              </summary>
              <form action={upsertTeamPost} className="mt-4 space-y-4">
                <input type="hidden" name="id" value={p.id} />
                <PostFields p={p} />
                <button type="submit" className="btn btn-primary">Save changes</button>
              </form>
            </details>
          ))}
        </div>
      </section>

      {/* Who gets in — needed a few times a season, so it stays folded away */}
      <details className="card p-5">
        <summary className="cursor-pointer font-bold text-gray-700 list-none">
          🔑 Who can get in — team password &amp; join instructions
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-500">
            One shared password for all parents &amp; players. Copy the join instructions to send to
            families, or set a new password anytime — e.g. each season, so last year’s group drops off.
          </p>
          <TeamCodePanel code={teamCode} joinUrl={joinUrl} />
          <form action={setTeamPassword} className="flex flex-wrap items-end gap-3">
            <div>
              <PasswordField
                name="team_password"
                label="New team password"
                placeholder="Type a new team password"
                required
                minLength={4}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn btn-maroon">Update password</button>
          </form>
        </div>
      </details>
    </div>
  )
}
