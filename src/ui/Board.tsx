import { art } from './assets'
import { useId, useMemo, useRef, useState } from 'react'
import { trajectory, type Weapon, type Point } from '../math/weapon'
export interface Box {
  x: number
  y: number
  w: number
  h: number
}
export interface GraphShot {
  w: Weapon
  start: Point
  dir: number
  u: number
}
export type Overlay = { w: Weapon; color: string }
const W = 960,
  H = 560
export function Board({
  weapon,
  origin = { x: 2, y: 1 },
  dir = 1,
  players = [],
  targets = [],
  boxes = [],
  shot = null,
  overlays = [],
  lab = false,
  impact = null,
  showGrid = true,
  gate,
  impactLabel,
  backdrop = 'battlefield-orbit.svg',
  land = [],
  terrainTint = '#817197',
  extraShots = [],
  battleScene,
  enemyPreview,
}: {
  enemyPreview?: { weapon: Weapon; origin: Point }
  backdrop?: string
  land?: Point[]
  terrainTint?: string
  battleScene?: React.ReactNode
  extraShots?: GraphShot[]
  weapon: Weapon | null
  origin?: Point
  dir?: number
  players?: Point[]
  targets?: Point[]
  boxes?: Box[]
  shot?: GraphShot | null
  overlays?: Overlay[]
  lab?: boolean
  impact?: Point | null
  showGrid?: boolean
  gate?: Point
  impactLabel?: string
}) {
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 }),
    [cursor, setCursor] = useState<Point | null>(null),
    drag = useRef<Point | null>(null)
  const id = useId().replace(/:/g, ''),
    ref = useRef<SVGSVGElement>(null)
  const sx = 40 * view.zoom,
    sy = sx,
    X = (x: number) => (x - view.x) * sx,
    Y = (y: number) => H - (y - view.y) * sy
  function path(
    w: Weapon,
    start: Point,
    d: number,
    end = 24,
    steps = 768,
    begin = 0,
  ) {
    let p = ''
    for (let i = 0; i <= steps; i++) {
      const t = trajectory(w, start, d, begin + ((end - begin) * i) / steps)
      const x = X(t.x),
        y = Y(t.y)
      p +=
        (i ? ' L' : 'M') +
        x.toFixed(2) +
        ' ' +
        Math.min(50000, Math.max(-50000, y)).toFixed(2)
    }
    return p
  }
  const primary = useMemo(
    () => (weapon ? path(weapon, origin, dir) : ''),
    [weapon, origin.x, origin.y, dir, view],
  )
  const enemyPath = useMemo(
    () =>
      enemyPreview ? path(enemyPreview.weapon, enemyPreview.origin, -1) : '',
    [
      enemyPreview?.weapon,
      enemyPreview?.origin.x,
      enemyPreview?.origin.y,
      view,
    ],
  )
  const overlayPaths = useMemo(
    () => overlays.map((o) => ({ ...o, path: path(o.w, origin, dir) })),
    [overlays, origin.x, origin.y, dir, view],
  )
  const projectile = shot
    ? trajectory(shot.w, shot.start, shot.dir, shot.u)
    : null
  const gridX = Array.from(
      { length: Math.ceil(24 / view.zoom) + 1 },
      (_, i) => Math.ceil(view.x) + i,
    ),
    gridY = Array.from(
      { length: Math.ceil(14 / view.zoom) + 1 },
      (_, i) => Math.ceil(view.y) + i,
    )
  function local(e: React.PointerEvent) {
    const c = ref.current!.createSVGPoint()
    c.x = e.clientX
    c.y = e.clientY
    const p = c.matrixTransform(ref.current!.getScreenCTM()!.inverse())
    return { x: p.x / sx + view.x, y: (H - p.y) / sy + view.y }
  }
  return (
    <div className={'board ' + (lab ? 'lab' : '')}>
      <svg
        ref={ref}
        role="img"
        tabIndex={lab ? 0 : undefined}
        aria-label={
          lab
            ? 'Trajectory plot. Arrow keys pan the view.'
            : 'Trajectory plot in world coordinates'
        }
        onKeyDown={(e) => {
          if (!lab) return
          const v = (
            {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, 1],
              ArrowDown: [0, -1],
            } as Record<string, number[]>
          )[e.key]
          if (v) {
            e.preventDefault()
            setView((p) => ({
              ...p,
              x: Math.max(-24, Math.min(36, p.x + v[0] / p.zoom)),
              y: Math.max(-16, Math.min(24, p.y + v[1] / p.zoom)),
            }))
          }
        }}
        viewBox={'0 0 ' + W + ' ' + H}
        onPointerDown={(e) => {
          if (lab) {
            drag.current = local(e)
            e.currentTarget.setPointerCapture(e.pointerId)
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onPointerMove={(e) => {
          const p = local(e)
          setCursor(p)
          if (drag.current && lab) {
            setView((v) => ({
              ...v,
              x: Math.max(-24, Math.min(36, v.x + drag.current!.x - p.x)),
              y: Math.max(-16, Math.min(24, v.y + drag.current!.y - p.y)),
            }))
          }
        }}
        onPointerLeave={() => setCursor(null)}
      >
        <defs>
          <filter
            id={id + 'glow'}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <image
          href={art(backdrop)}
          width={W}
          height={H}
          preserveAspectRatio="xMidYMid slice"
          opacity={lab ? 0.24 : 0.48}
        />
        <rect width={W} height={H} fill="#100e22" opacity=".3" />
        {showGrid && (
          <g className="grid">
            {gridX.map((x) => (
              <line
                key={x}
                x1={X(x)}
                x2={X(x)}
                y1={0}
                y2={H}
                opacity={x % 2 ? 0.32 : 0.6}
              />
            ))}
            {gridY.map((y) => (
              <line
                key={y}
                x1={0}
                x2={W}
                y1={Y(y)}
                y2={Y(y)}
                opacity={y % 2 ? 0.32 : 0.6}
              />
            ))}
          </g>
        )}
        <g className="ticks">
          {gridX
            .filter((x) => x % 2 === 0 && X(x) < W - 12)
            .map((x) => (
              <text key={x} x={X(x) + 5} y={H - 8}>
                {x}
              </text>
            ))}
          {gridY
            .filter((y) => y % 2 === 0 && y !== 0)
            .map((y) => (
              <text key={y} x="5" y={Math.max(14, Y(y) - 4)}>
                {y}
              </text>
            ))}
        </g>
        {land.length > 0 && (
          <polygon
            points={[...land, { x: 24, y: -1 }, { x: 0, y: -1 }]
              .map((p) => X(p.x) + ',' + Y(p.y))
              .join(' ')}
            fill={terrainTint}
            fillOpacity=".54"
            stroke={terrainTint}
            strokeWidth="2"
          />
        )}
        {boxes.map((b, i) => (
          <g key={i}>
            <rect
              x={X(b.x)}
              y={Y(b.y + b.h)}
              width={b.w * sx}
              height={b.h * sy}
              fill="#443854"
              stroke="#bb9da8"
              strokeWidth="2"
            />
            <line
              x1={X(b.x)}
              y1={Y(b.y + b.h)}
              x2={X(b.x + b.w)}
              y2={Y(b.y + b.h)}
              stroke="#fdc4aa"
              strokeWidth="4"
            />
          </g>
        ))}
        {overlayPaths.map((o, i) => (
          <path
            key={i}
            d={o.path}
            fill="none"
            stroke={o.color}
            strokeWidth="2.5"
          />
        ))}
        {enemyPath && (
          <path
            d={enemyPath}
            fill="none"
            stroke="#ffa799"
            strokeWidth="3"
            strokeDasharray="2 8"
          />
        )}
        {primary && (
          <path
            data-testid="preview"
            d={primary}
            fill="none"
            stroke={dir === 1 ? '#b9a8ff' : '#ff9da7'}
            strokeWidth="3"
            strokeDasharray="2 8"
            strokeLinecap="round"
          />
        )}
        {!battleScene &&
          players.map((p, i) => (
            <image
              key={i}
              href={art('rover-' + (i === 0 ? 'blue' : 'coral') + '.svg')}
              x={X(p.x) - sx * 0.82}
              y={Y(p.y) - sy * 0.44}
              width={sx * 1.64}
              height={sy * 0.97}
              className="rover"
            />
          ))}
        {!players.length && (
          <circle cx={X(origin.x)} cy={Y(origin.y)} r={6} fill="#bbabff" />
        )}
        {gate && (
          <g
            transform={'translate(' + X(gate.x) + ',' + Y(gate.y) + ')'}
            stroke="#75edd7"
            fill="none"
            strokeWidth="3"
          >
            <path
              d={
                'M-7 ' +
                -sy * 0.45 +
                'H7 M0 ' +
                -sy * 0.45 +
                'V' +
                sy * 0.45 +
                ' M-7 ' +
                sy * 0.45 +
                'H7'
              }
            />
          </g>
        )}
        {targets.map((p, i) => (
          <g
            key={i}
            transform={'translate(' + X(p.x) + ',' + Y(p.y) + ')'}
            fill="none"
            stroke="#ffb19e"
            strokeWidth="2"
          >
            <circle r={0.55 * sx} />
            <circle r={0.28 * sx} />
            <path d="M-6 0H6M0 -6V6" />
          </g>
        ))}
        {extraShots.map((f, i) => {
          const tip = trajectory(f.w, f.start, f.dir, f.u)
          const color = ['#8ceaff', '#cca4ff', '#ffa4dd', '#ffdf84'][f.w.tier]
          return (
            <g key={i} fill="none" strokeLinecap="round">
              {[0, 1, 2, 3].map((k) => {
                const start = Math.max(0, f.u - (4 - k) * 0.42),
                  end = Math.max(0, f.u - (3 - k) * 0.42)
                return (
                  <path
                    key={k}
                    d={path(f.w, f.start, f.dir, end, 14, start)}
                    stroke={color}
                    strokeWidth={2 + k + f.w.tier}
                    opacity={(k + 1) * 0.22}
                  />
                )
              })}
              <circle
                cx={X(tip.x)}
                cy={Y(tip.y)}
                r={9 + f.w.tier * 2}
                fill={color}
                opacity=".22"
              />
              <circle
                cx={X(tip.x)}
                cy={Y(tip.y)}
                r={3 + f.w.tier}
                fill="white"
              />
            </g>
          )
        })}
        {shot && projectile && (
          <g>
            <path
              fill="none"
              stroke={['#79dfff', '#bca6ff', '#f3abf0', '#fff7ba'][shot.w.tier]}
              strokeWidth={2 + shot.w.tier}
              d={path(shot.w, shot.start, shot.dir, shot.u, 100)}
            />
            <circle
              cx={X(projectile.x)}
              cy={Y(projectile.y)}
              r={8 + shot.w.tier}
              fill="#b299ff"
              filter={'url(#' + id + 'glow)'}
            />
            <circle
              cx={X(projectile.x)}
              cy={Y(projectile.y)}
              r={4 + shot.w.tier}
              fill="white"
            />
          </g>
        )}
        {battleScene}
        {impact && (
          <g
            key={impact.x + ',' + impact.y}
            className="impact"
            transform={'translate(' + X(impact.x) + ',' + Y(impact.y) + ')'}
          >
            {impactLabel && (
              <text
                x="0"
                y="-20"
                textAnchor="middle"
                fill="#ffccaf"
                fontSize="22"
                fontWeight="bold"
              >
                {impactLabel}
              </text>
            )}
            {Array.from({ length: 10 }, (_, i) => (
              <line
                key={i}
                transform={'rotate(' + i * 36 + ')'}
                x1="8"
                y1="0"
                x2="26"
                y2="0"
                stroke="#ffccac"
                strokeWidth="3"
              />
            ))}
          </g>
        )}
      </svg>
      {lab && (
        <div className="graph-tools">
          <button
            aria-label="Zoom in"
            onClick={() =>
              setView((v) => ({ ...v, zoom: Math.min(4, v.zoom * 1.25) }))
            }
          >
            +
          </button>
          <button
            aria-label="Zoom out"
            onClick={() =>
              setView((v) => ({ ...v, zoom: Math.max(0.65, v.zoom / 1.25) }))
            }
          >
            −
          </button>
          <button onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>
            Reset view
          </button>
        </div>
      )}
      <div className="plot-foot">
        <span>● &nbsp; {lab ? 'FUNCTION PLOT' : 'TRAJECTORY PREVIEW'}</span>
        <span>
          {cursor
            ? 'x ' + cursor.x.toFixed(2) + '   y ' + cursor.y.toFixed(2)
            : '24 × 14 WORLD UNITS'}
        </span>
      </div>
    </div>
  )
}
