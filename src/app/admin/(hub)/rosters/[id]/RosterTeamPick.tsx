'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { assignRosterTeam } from '@/lib/depthActions'
import type { Team } from '@/lib/teams'

/** Which team this roster is: varsity's or JV's. Its players are tagged to match. */
export function RosterTeamPick({ rosterId, team }: { rosterId: string; team: Team | null }) {
  const router = useRouter()
  const [value, setValue] = useState<string>(team ?? '')
  const [msg, setMsg] = useState('')
  const [busy, start] = useTransition()
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="field-label !mb-0" htmlFor="roster-team">Team</label>
      <select
        id="roster-team"
        value={value}
        disabled={busy}
        onChange={(e) => {
          const next = e.target.value
          setValue(next)
          start(async () => {
            const r = await assignRosterTeam(rosterId, next === 'varsity' || next === 'jv' ? next : null)
            setMsg(r.ok ? (next ? `This is the ${next === 'jv' ? 'JV' : 'varsity'} roster now.` : 'Saved') : r.error)
            router.refresh()
          })
        }}
        className="field !py-1.5 !w-auto"
      >
        <option value="">Not set</option>
        <option value="varsity">Varsity</option>
        <option value="jv">JV</option>
      </select>
      <span className="text-xs text-gray-500" role="status">{busy ? 'Saving…' : msg}</span>
    </div>
  )
}
