'use client'
import { useEffect, useRef, useState } from 'react'
import { FieldBoard } from './FieldBoard'
import { CLIP_SPEEDS, clipLength, frameAt, type BoardClip } from '@/lib/planner'

/**
 * A recorded play, played back.
 *
 * The clip is the board at every moment it changed while the coach was drawing
 * it, so playing it is a matter of walking the clock and painting whichever
 * frame the clock has reached. Speed divides the clock rather than skipping
 * frames — a play at a quarter speed is the same play, slow enough to talk
 * over, with nothing missing.
 *
 * It ends on the last frame rather than snapping back to an empty field,
 * because the last frame is the play.
 */

const TICK = 60 // ms between repaints — smooth enough, cheap enough for a phone

export function ClipPlayer({ clip, autoPlay = false }: { clip: BoardClip; autoPlay?: boolean }) {
  const length = clipLength(clip)
  const [at, setAt] = useState(autoPlay ? 0 : length)
  const [playing, setPlaying] = useState(autoPlay)
  const [speed, setSpeed] = useState(1)
  const clock = useRef(at)

  useEffect(() => {
    if (!playing) return
    // Starting again from the end means starting again, not sitting there.
    if (clock.current >= length) clock.current = 0

    const id = setInterval(() => {
      clock.current += TICK * speed
      if (clock.current >= length) {
        clock.current = length
        setAt(length)
        setPlaying(false)
        return
      }
      setAt(clock.current)
    }, TICK)
    return () => clearInterval(id)
  }, [playing, speed, length])

  function scrub(ms: number) {
    clock.current = ms
    setAt(ms)
  }

  return (
    <div>
      <FieldBoard board={frameAt(clip, at)} readOnly />

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="btn btn-primary !py-1.5 !px-3 text-sm"
        >
          {playing ? 'Pause' : at >= length ? 'Play again' : 'Play'}
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(length, 1)}
          step={10}
          value={at}
          onChange={(e) => scrub(Number(e.target.value))}
          aria-label="Position in the play"
          className="flex-1 min-w-[8rem] accent-[var(--gh-green)]"
        />

        <span className="text-xs text-gray-400 tabular-nums w-14 text-right">
          {(at / 1000).toFixed(1)}s / {(length / 1000).toFixed(1)}s
        </span>

        <div className="flex items-center gap-1">
          {CLIP_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className="px-2 py-1 rounded-lg text-xs font-bold border"
              style={{
                borderColor: speed === s ? 'var(--gh-green)' : '#e5e7eb',
                background: speed === s ? 'var(--gh-green)' : '#fff',
                color: speed === s ? '#fff' : '#6b7280',
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
