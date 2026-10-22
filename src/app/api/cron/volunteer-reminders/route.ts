import { NextResponse, type NextRequest } from 'next/server'
import { sendDueReminders } from '@/lib/gameVolunteers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/volunteer-reminders — run each morning by Vercel Cron.
 *
 * Emails everyone with a volunteer spot at a game between now and the end of
 * tomorrow who hasn't had a reminder yet. Each person gets one, so running it
 * twice sends nothing new. With CRON_SECRET set, Vercel signs the call with
 * it and nothing else may run it.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  const fromCron = secret ? auth === `Bearer ${secret}` : /vercel-cron/i.test(request.headers.get('user-agent') ?? '')
  if (!fromCron) return NextResponse.json({ error: 'Not allowed.' }, { status: 401 })
  const sent = await sendDueReminders()
  return NextResponse.json({ ok: true, sent })
}
