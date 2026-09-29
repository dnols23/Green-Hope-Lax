import { createServiceClient } from './supabase-server'

/**
 * Recruits: kids the staff is reaching out to about playing lacrosse. Every
 * coach adds them and moves them along; server only, service role.
 */

export const RECRUIT_STATUSES = [
  { key: 'identified', label: 'Identified', tone: { bg: 'var(--color-gray-100, #f3f4f6)', fg: 'var(--color-gray-600, #4b5563)' } },
  { key: 'tweeted', label: 'Tweeted', tone: { bg: '#e6f0fb', fg: '#1f5fa8' } },
  { key: 'followed', label: 'Followed back', tone: { bg: '#eef0fe', fg: '#4a3aa7' } },
  { key: 'talking', label: 'Talking', tone: { bg: '#fdf3dc', fg: '#8a5a00' } },
  { key: 'visited', label: 'Visited', tone: { bg: '#fde8ea', fg: '#7A1F2B' } },
  { key: 'joined', label: 'Joined', tone: { bg: '#e3f4ea', fg: '#00512F' } },
  { key: 'passed', label: 'Not interested', tone: { bg: 'var(--color-gray-100, #f3f4f6)', fg: 'var(--color-gray-400, #9ca3af)' } },
] as const

export type RecruitStatus = (typeof RECRUIT_STATUSES)[number]['key']
export const isRecruitStatus = (v: unknown): v is RecruitStatus => RECRUIT_STATUSES.some((s) => s.key === v)
export const statusOf = (key: string) => RECRUIT_STATUSES.find((s) => s.key === key) ?? RECRUIT_STATUSES[0]

export interface Recruit {
  id: string
  name: string
  gradYear: number | null
  school: string | null
  sports: string | null
  position: string | null
  handle: string | null
  parentName: string | null
  parentContact: string | null
  status: RecruitStatus
  nextStep: string | null
  notes: string | null
  coach: string | null
  tweetedAt: string | null
  addedBy: string | null
  addedByName: string | null
  createdAt: string
  updatedAt: string
}

/** "@Jake_Smith", "x.com/jake_smith", "twitter.com/jake_smith?s=21" → "jake_smith". */
export function cleanHandle(raw: string): string | null {
  const s = raw.trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '').replace(/^@/, '').split(/[/?#\s]/)[0]
  return /^[A-Za-z0-9_]{1,30}$/.test(s) ? s : null
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)

function read(r: Record<string, unknown>): Recruit {
  const year = Number(r.grad_year)
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    gradYear: Number.isInteger(year) && year > 0 ? year : null,
    school: str(r.school),
    sports: str(r.sports),
    position: str(r.position),
    handle: str(r.handle),
    parentName: str(r.parent_name),
    parentContact: str(r.parent_contact),
    status: isRecruitStatus(r.status) ? r.status : 'identified',
    nextStep: str(r.next_step),
    notes: str(r.notes),
    coach: str(r.coach),
    tweetedAt: str(r.tweeted_at),
    addedBy: str(r.added_by),
    addedByName: str(r.added_by_name),
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? r.created_at ?? ''),
  }
}

/** Every recruit, most recently touched first; null before 0052 has been run. */
export async function listRecruits(): Promise<Recruit[] | null> {
  const { data, error } = await createServiceClient().from('recruits').select('*').order('updated_at', { ascending: false })
  if (error) return null
  return ((data ?? []) as Record<string, unknown>[]).map(read)
}

export async function getRecruit(id: string): Promise<Recruit | null> {
  if (!id) return null
  const { data } = await createServiceClient().from('recruits').select('*').eq('id', id).maybeSingle()
  return data ? read(data as Record<string, unknown>) : null
}
