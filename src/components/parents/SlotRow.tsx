'use client'
import { useActionState } from 'react'
import { takeSlot, dropSlot } from '@/lib/parentActions'
import type { FormState } from '@/lib/actions'
import { SubmitButton } from '@/components/SubmitButton'
import type { SignupClaim, SignupSlot } from '@/lib/signupSheets'

const initial: FormState = { ok: false }

/**
 * One job on the sheet: what it is, who has it, and the button to take it.
 *
 * A spot already taken shows the name — the point of a sign-up sheet is that
 * everyone can see somebody has the oranges covered.
 */
export function SlotRow({
  sheetId,
  slot,
  open,
  parentId,
}: {
  sheetId: string
  slot: SignupSlot & { claims: SignupClaim[] }
  open: boolean
  parentId: string | null
}) {
  const [state, formAction] = useActionState(takeSlot, initial)

  const left = Math.max(0, slot.needed - slot.claims.length)
  const mine = slot.claims.find((c) => c.parent_id && c.parent_id === parentId)

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-52 flex-1">
          <div className="font-bold">
            {slot.label}
            {slot.needed > 1 && (
              <span className="ml-2 text-xs font-semibold text-gray-400">
                {slot.claims.length} of {slot.needed}
              </span>
            )}
          </div>
          {slot.detail && <p className="text-sm text-gray-500 mt-0.5">{slot.detail}</p>}

          {slot.claims.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {slot.claims.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-semibold" style={{ color: 'var(--gh-green)' }}>
                    ✓ {c.name}
                  </span>
                  {c.note && <span className="text-gray-500"> — {c.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0">
          {mine ? (
            <form action={dropSlot}>
              <input type="hidden" name="claim_id" value={mine.id} />
              <input type="hidden" name="sheet_id" value={sheetId} />
              <button type="submit" className="text-sm font-semibold text-[var(--gh-maroon)]">
                I can&rsquo;t after all
              </button>
            </form>
          ) : !open ? (
            <span className="text-xs font-semibold text-gray-400">Closed</span>
          ) : left === 0 ? (
            <span className="text-xs font-semibold text-gray-400">Filled</span>
          ) : (
            <form action={formAction} className="flex flex-col items-end gap-2">
              <input type="hidden" name="slot_id" value={slot.id} />
              <input type="hidden" name="sheet_id" value={sheetId} />
              <input
                name="note"
                placeholder="Note (optional)"
                className="field !py-1.5 text-sm w-44"
              />
              <SubmitButton className="btn btn-primary !py-1.5" pendingText="Signing up…">
                I&rsquo;ve got it
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
      {state.error && (
        <p className="text-sm font-semibold text-[var(--gh-maroon)] mt-2">{state.error}</p>
      )}
    </div>
  )
}
