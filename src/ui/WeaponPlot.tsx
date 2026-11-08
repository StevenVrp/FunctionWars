import { useMemo } from 'react'
import { compile, trajectory } from '../math/weapon'
import type { Saved } from '../data/storage'
export function WeaponPlot({ item }: { item: Saved }) {
  const points = useMemo(() => {
    const w = compile(item.source, item.parameters),
      ys = Array.from(
        { length: 121 },
        (_, i) => trajectory(w, { x: 0, y: 0 }, 1, i / 5).y,
      ),
      lo = Math.min(0, ...ys),
      hi = Math.max(0, ...ys)
    return ys
      .map((y, i) =>
        [5 + i, 55 - (48 * (y - lo)) / Math.max(1, hi - lo)].join(','),
      )
      .join(' ')
  }, [item])
  return (
    <svg
      className="weapon-plot"
      viewBox="0 0 130 62"
      role="img"
      aria-label={'Trajectory for ' + item.name}
    >
      <path d="M5 3v54h120" stroke="#716682" fill="none" />
      <polyline
        points={points}
        stroke={item.color}
        strokeWidth="2"
        fill="none"
      />
    </svg>
  )
}
