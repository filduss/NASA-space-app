import type { Level } from './model.ts'

export const LEVEL_WORD: Record<Level, string> = { ok: 'Normal', watch: 'Watch', alert: 'Alert' }

/** Shape carries the level as well as colour: circle, triangle, octagon. */
export function LevelIcon({ level, size = 16 }: { level: Level; size?: number }) {
  return (
    <svg className={`lvl lvl-${level}`} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      {level === 'ok' && (
        <>
          <circle cx="10" cy="10" r="9" className="lvl-fill" />
          <path d="M6 10.4l2.6 2.6L14.2 7.4" className="lvl-mark" />
        </>
      )}
      {level === 'watch' && (
        <>
          <path d="M10 1.8L18.6 17H1.4z" className="lvl-fill" strokeLinejoin="round" />
          <path d="M10 7.2v4.6M10 14.3v.1" className="lvl-mark" />
        </>
      )}
      {level === 'alert' && (
        <>
          <path d="M6.3 1h7.4L19 6.3v7.4L13.7 19H6.3L1 13.7V6.3z" className="lvl-fill" />
          <path d="M10 5.6v5.6M10 14.2v.1" className="lvl-mark" />
        </>
      )}
    </svg>
  )
}
