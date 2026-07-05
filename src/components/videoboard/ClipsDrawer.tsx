'use client'

import styles from './VideoBoard.module.css'
import { IconClose, IconPlay, IconTrash } from './icons'
import type { Clip, LibVideo } from './types'
import { baseName, fmtDuration, fmtTime, shortName } from './utils'

type ClipsDrawerProps = {
  open: boolean
  clips: Clip[]
  videos: LibVideo[]
  onClose: () => void
  onPlay: (clip: Clip) => void
  onDelete: (id: number) => void
}

export function ClipsDrawer({ open, clips, videos, onClose, onPlay, onDelete }: ClipsDrawerProps) {
  return (
    <div className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}>
      <div className={styles.drawerHead}>
        <span className={styles.drawerTitle}>Clips</span>
        <span className={styles.drawerCount}>{clips.length}</span>
        <button type="button" className={styles.drawerClose} title="Close" onClick={onClose}>
          <IconClose size={14} />
        </button>
      </div>
      <div className={styles.drawerBody}>
        {clips.length === 0 ? (
          <div className={styles.noClips}>
            No clips yet.
            <br />
            Mark In / Out points in Panel 1 to create one.
          </div>
        ) : (
          clips.map((clip) => {
            const source = videos.find((v) => v.id === clip.videoId)
            return (
              <div key={clip.id} className={styles.clipCard}>
                <div className={styles.clipInfo}>
                  <div className={styles.clipName} title={clip.name}>{clip.name}</div>
                  <div className={styles.clipMeta}>
                    {fmtTime(clip.start)}–{fmtTime(clip.end)} · {fmtDuration(clip.end - clip.start)}
                    {source ? ` · ${shortName(baseName(source.name), 16)}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className={`${styles.clipAct} ${styles.clipActPlay}`}
                  title="Load and play clip"
                  onClick={() => onPlay(clip)}
                >
                  <IconPlay size={14} />
                </button>
                <button
                  type="button"
                  className={`${styles.clipAct} ${styles.clipActDel}`}
                  title="Delete clip"
                  onClick={() => onDelete(clip.id)}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
