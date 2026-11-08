import { tanks, selectTank } from '../combat/tanks'
import { height, maps } from '../combat/maps'
import type { Live } from '../combat/live'
import { art } from './assets'
const X = (x: number) => x * 40,
  Y = (y: number) => 560 - y * 40
const clamp = (x: number) => Math.max(0, Math.min(1, x))
function vehicle(
  file: string,
  x: number,
  y: number,
  width: number,
  flip: boolean,
  recoil = 0,
) {
  const h = (width * 84) / 144
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <image
        href={art(file)}
        x={-width / 2 - recoil}
        y={(-h * 76) / 84}
        width={width}
        height={h}
      />
    </g>
  )
}
function debris(
  t: number,
  color: string,
  count: number,
  span: number,
  seed: number,
) {
  return Array.from({ length: count }, (_, i) => {
    const a = i * 2.39996 + seed * 0.761,
      reach = span * (0.52 + 0.45 * Math.abs(Math.sin(i + seed))),
      x = Math.cos(a) * reach * t,
      y = Math.sin(a) * reach * t + 30 * t * t
    return (
      <path
        key={i}
        d={'M0 0l' + (i % 2 ? '-4 -1 1 -3z' : '-2 -5')}
        transform={`translate(${x} ${y}) rotate(${i * 39 + 150 * t})`}
        stroke={color}
        fill={color}
        opacity={1 - t}
      />
    )
  })
}
export function BattleScene({
  s,
  now,
  reduce,
}: {
  s: Live
  now: number
  reduce: boolean
}) {
  const land = maps[s.map].land
  const effects = s.events.filter(
    (e) => now >= e.time && now - e.time < (reduce ? 320 : 1450),
  )
  return (
    <g pointerEvents="none">
      {s.players.map((p, i) => {
        const tank = tanks[selectTank(p.tank)],
          d = i ? -1 : 1,
          shot = [...s.events]
            .reverse()
            .find((e) => e.actor === i && e.kind === 'launch'),
          recoil =
            shot && !reduce ? 5 * Math.max(0, 1 - (now - shot.time) / 220) : 0
        const x = X(p.x),
          foot = Y(height(land, p.x)),
          sx = Math.max(0.6, Math.min(23.4, p.x - d * 1.45))
        const deploy = [...s.events]
            .reverse()
            .find((e) => e.kind === 'auto' && e.actor === i),
          roll = reduce || !deploy ? 1 : clamp((now - deploy.time) / 550),
          sentryX = sx + d * (1 - roll) ** 2 * 0.95
        const sentryFire = [...s.events]
          .reverse()
          .find(
            (e) => e.kind === 'sentry' && e.actor === i && now - e.time < 800,
          )
        return (
          <g key={i}>
            <ellipse
              cx={x}
              cy={foot - 2}
              rx={34}
              ry={4}
              fill="#080b16"
              opacity=".7"
            />
            {vehicle(tank.sprite, x, foot, 88, i === 1, recoil)}
            <path
              d={`M${x - 12} ${foot + 3}h24`}
              stroke={i ? '#ff9e98' : '#8effeb'}
              strokeWidth="3"
            />
            {p.shield !== null && (
              <path
                d={`M${x - 39} ${foot - 4}Q${x - 54} ${foot - 67} ${x} ${foot - 70}Q${x + 54} ${foot - 67} ${x + 39} ${foot - 4}`}
                fill="#a8eaff12"
                stroke={tank.color}
                strokeWidth="2"
                strokeDasharray="12 4"
              />
            )}
            {(p.auto || sentryFire) && (
              <g
                opacity={p.auto ? 1 : clamp(1 - (now - sentryFire!.time) / 800)}
              >
                {vehicle(
                  'tank-sentry.svg',
                  X(sentryX),
                  Y(height(land, sentryX)),
                  54,
                  i === 1,
                  sentryFire && !reduce
                    ? 3 * clamp(1 - (now - sentryFire.time) / 150)
                    : 0,
                )}
                {sentryFire && (
                  <path
                    d={`M${X(sx) + d * 23} ${Y(height(land, sx)) - 24} L${X(sentryFire.at.x)} ${Y(sentryFire.at.y)}`}
                    fill="none"
                    stroke="#a7ff9b"
                    strokeWidth={Math.max(1, 5 - (now - sentryFire.time) / 160)}
                  />
                )}
              </g>
            )}
          </g>
        )
      })}
      {effects.map((e) => {
        const t = reduce ? 0.45 : clamp((now - e.time) / 1450),
          fade = 1 - t,
          tx = X(e.at.x),
          ty = Y(e.at.y),
          color = tanks[selectTank(s.players[e.actor].tank)].color
        if (e.kind === 'pulse') return null
        if (e.kind === 'shift')
          return (
            <g key={e.seq} opacity={fade}>
              <path
                d={`M0 ${540 - 470 * t}Q480 ${470 - 470 * t} 960 ${540 - 470 * t}`}
                fill="none"
                stroke="#c8b1ff"
                strokeWidth={5 * (1 - t) + 1}
              />
              <path
                d={land
                  .map((p, i) => (i ? 'L' : 'M') + X(p.x) + ' ' + Y(p.y))
                  .join(' ')}
                fill="none"
                stroke="#f1ddff"
                strokeWidth={4 * fade}
              />
            </g>
          )
        let effect
        if (e.kind === 'launch') {
          const k = clamp(1 - (now - e.time) / 190)
          effect = (
            <path
              d="M0 0l24 -9 -8 8 17 2 -19 4 3 6z"
              transform={`translate(${e.actor ? -34 : 34},-1) scale(${e.actor ? -k : k} ${k})`}
              fill="#fff0c4"
            />
          )
        } else if (e.kind === 'nuke') {
          effect = (
            <>
              <path
                d="M-90 -240L0 0"
                stroke="#fff0b4"
                opacity={Math.max(0, 1 - 5 * t)}
                strokeWidth="7"
              />
              <ellipse
                rx={5 + 110 * t}
                ry={4 + 28 * t}
                stroke="#ffae60"
                strokeWidth={6 * fade}
                fill="none"
              />
              <circle r={6 + 32 * Math.sin(t * Math.PI)} fill="#ffca7777" />
              {debris(t, '#ffcb85', 23, 110, e.seq)}
            </>
          )
        } else if (e.kind === 'wall') {
          effect = (
            <g transform={`translate(0,${-80 * (1 - t) ** 4})`}>
              <rect
                x="-19"
                y="-48"
                width="38"
                height="96"
                fill="#f3ab5438"
                stroke="#ffcb8c"
                strokeWidth="3"
              />
              <path
                d="M-13 -30l26 13m-26 8 26 13m-26 8 26 13"
                stroke="#ffe4ac"
              />
            </g>
          )
        } else if (
          e.kind === 'impact' ||
          e.kind === 'shatter' ||
          e.kind === 'damage' ||
          e.kind === 'sentry'
        ) {
          effect = (
            <>
              <circle
                r={3 + t * (e.kind === 'shatter' ? 42 : 23)}
                fill="none"
                stroke="#ffbf92"
                strokeWidth={3 * fade}
              />
              {debris(
                t,
                e.kind === 'sentry' ? '#9affaa' : '#ffbaa6',
                e.kind === 'shatter' ? 18 : 10,
                52,
                e.seq,
              )}
              {e.kind === 'damage' && (
                <text
                  y={-19 - t * 26}
                  textAnchor="middle"
                  fill="#fff0de"
                  fontSize="18"
                  fontWeight="bold"
                >
                  {e.text}
                </text>
              )}
            </>
          )
        } else if (e.kind.startsWith('shield') || e.kind === 'block') {
          const r = 25 + 16 * t
          effect = (
            <>
              <polygon
                points={Array.from({ length: 6 }, (_, i) =>
                  [
                    r * Math.cos((i * Math.PI) / 3),
                    r * Math.sin((i * Math.PI) / 3),
                  ].join(','),
                ).join(' ')}
                fill={color + '22'}
                stroke={color}
                strokeWidth="3"
              />
              <circle
                r={r + 6}
                stroke={color}
                strokeDasharray="6 9"
                fill="none"
              />
            </>
          )
        } else if (
          e.kind === 'bank' ||
          e.kind === 'cycle' ||
          e.kind === 'repair'
        ) {
          effect = (
            <g
              stroke={e.kind === 'repair' ? '#92efa3' : color}
              fill="none"
              strokeWidth="3"
            >
              {[0, 1, 2].map((i) => (
                <path key={i} d={`M-13 ${4 - i * 9 - 18 * t}l13 -6 13 6`} />
              ))}
            </g>
          )
        } else if (e.kind === 'auto') {
          effect = (
            <ellipse
              rx={20 + 24 * t}
              ry={6 + 5 * t}
              fill="none"
              stroke="#99f69e"
              strokeDasharray="6 4"
            />
          )
        } else if (e.kind === 'move') {
          effect = debris(t, '#b0a59a', 7, 22, e.seq)
        } else
          effect = (
            <g transform={`rotate(${120 * t})`}>
              <circle
                r={19 + 15 * t}
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeDasharray="18 6"
              />
              {debris(t, color, 8, 35, e.seq)}
            </g>
          )
        return (
          <g key={e.seq} transform={`translate(${tx} ${ty})`} opacity={fade}>
            {effect}
          </g>
        )
      })}
    </g>
  )
}
