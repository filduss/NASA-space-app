// A plain body sketch. Zones that are off get a hatch and a triangle, so the picture reads
// without color; the words underneath say the same thing.

export type Zone = 'head' | 'sleep' | 'body' | 'hands'

export function Body({ zones, absent, label }: { zones: Zone[]; absent?: boolean; label: string }) {
  const on = (z: Zone) => zones.includes(z)
  const tri = (x: number, y: number) => <path className="body-flag" d={`M${x},${y - 9}l8,14h-16z`} />
  return (
    <svg className={`body${absent ? ' body-absent' : ''}`} viewBox="0 0 120 190" role="img" aria-label={label}>
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" className="body-hatch-line" />
        </pattern>
      </defs>
      {/* arms */}
      <path className="body-part" d="M42,62 Q24,70 22,112" />
      <path className="body-part" d="M78,62 Q96,70 98,112" />
      {/* legs */}
      <path className="body-part" d="M50,118 L46,176" />
      <path className="body-part" d="M70,118 L74,176" />
      {/* torso */}
      <rect className={`body-shape${on('body') ? ' body-on' : ''}`} x="40" y="54" width="40" height="68" rx="14" />
      {/* head */}
      <circle className={`body-shape${on('head') ? ' body-on' : ''}`} cx="60" cy="30" r="18" />
      {/* hands */}
      <circle className={`body-shape${on('hands') ? ' body-on' : ''}`} cx="22" cy="116" r="6" />
      <circle className={`body-shape${on('hands') ? ' body-on' : ''}`} cx="98" cy="116" r="6" />
      {on('head') && tri(84, 16)}
      {on('body') && tri(92, 80)}
      {on('hands') && tri(108, 134)}
      {on('sleep') && (
        <g>
          <path className="body-moon" d="M24,14 a13,13 0 1 0 12,18 a10,10 0 0 1 -12,-18z" />
          {tri(14, 44)}
        </g>
      )}
    </svg>
  )
}
