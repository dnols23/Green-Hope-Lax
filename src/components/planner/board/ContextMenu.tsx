'use client'
import { useState } from 'react'
import { isPlayerKind, tokenStyle } from '@/lib/planner'
import { Icon } from './Icon'
import { MenuItem, MenuLabel, MenuRule, Popover } from './Popover'
import { ArrangeItems } from './PropsBar'
import type { Editor } from './types'

/**
 * The menu on a right-click, or a long press on a phone: the common things to
 * do to what is under the pointer, where the pointer is. On the grass with
 * nothing picked, it is paste and select all.
 */
export function ContextMenu({ ed, at, onClose }: { ed: Editor; at: { x: number; y: number }; onClose: () => void }) {
  const [lookName, setLookName] = useState('')
  const n = ed.items.length
  const run = (f: () => void) => () => {
    f()
    onClose()
  }
  const anchor = { left: at.x, top: at.y, right: at.x, bottom: at.y }
  const only = n === 1 ? ed.items[0] : null
  const tokens = ed.items.filter((x) => x.type === 'token').length
  const grouped = ed.items.some((x) => x.it.group)
  const locked = n > 0 && ed.items.every((x) => x.it.locked)

  return (
    <Popover anchor={anchor} onClose={onClose} label={n ? 'What to do with it' : 'Board'} width={340}>
      {n === 0 ? (
        <>
          <MenuItem icon={<Icon name="paste" size={16} />} keys="⌘V" onClick={run(ed.paste)} disabled={!ed.hasClip()}>
            Paste
          </MenuItem>
          <MenuItem icon={<Icon name="select_all" size={16} />} keys="⌘A" onClick={run(ed.selectAll)}>
            Select all
          </MenuItem>
          <MenuItem icon={<Icon name="undo" size={16} />} keys="⌘Z" onClick={run(ed.undo)} disabled={!ed.canUndo}>
            Undo
          </MenuItem>
        </>
      ) : (
        <>
          <MenuLabel>
            {only?.type === 'token'
              ? isPlayerKind(only.it.kind) ? 'Player' : tokenStyle(only.it.kind).label
              : only ? ({ path: 'Line', text: 'Words', shape: 'Shape' } as const)[only.type] : `${n} picked`}
          </MenuLabel>
          {only?.type === 'text' && !only.it.locked && (
            <MenuItem icon={<Icon name="text" size={16} />} keys="Enter" onClick={() => ed.editText(only.it.id)}>
              Edit the words
            </MenuItem>
          )}
          <div className="grid grid-cols-2 gap-x-1">
            <MenuItem icon={<Icon name="cut" size={16} />} keys="⌘X" onClick={run(ed.cut)}>Cut</MenuItem>
            <MenuItem icon={<Icon name="copy" size={16} />} keys="⌘C" onClick={run(ed.copy)}>Copy</MenuItem>
            <MenuItem icon={<Icon name="paste" size={16} />} keys="⌘V" onClick={run(ed.paste)} disabled={!ed.hasClip()}>Paste</MenuItem>
            <MenuItem icon={<Icon name="duplicate" size={16} />} keys="⌘D" onClick={run(ed.duplicate)}>Duplicate</MenuItem>
          </div>
          <MenuItem icon={<Icon name="trash" size={16} />} keys="Del" danger onClick={run(ed.remove)}>
            Delete
          </MenuItem>
          <MenuRule />
          <ArrangeItems ed={ed} n={n} grouped={grouped} locked={locked} onDone={onClose} />
          {tokens > 0 && (
            <>
              <MenuRule />
              <MenuLabel>Keep the players as a look</MenuLabel>
              <div className="flex items-center gap-1.5 px-1 pb-1">
                <input
                  value={lookName}
                  onChange={(e) => setLookName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter' && lookName.trim()) {
                      e.preventDefault()
                      ed.saveLook(lookName)
                      onClose()
                    }
                  }}
                  placeholder="Name this look"
                  className="field !py-1 text-sm flex-1 min-h-9"
                  aria-label="Name this look"
                />
                <button
                  type="button"
                  onClick={run(() => ed.saveLook(lookName))}
                  disabled={!lookName.trim()}
                  className="min-h-9 px-3 rounded-lg text-xs font-bold border disabled:opacity-40"
                  style={{ background: 'var(--gh-green)', color: '#fff', borderColor: 'var(--gh-green)' }}
                >
                  Save
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Popover>
  )
}
