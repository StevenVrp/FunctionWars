import { useState } from 'react'
import {
  barrierCost,
  barrierLimit,
  planBarrier,
  type Live,
} from '../combat/live'
import { maps } from '../combat/maps'

export function BarrierPlanner({
  state,
  actor,
  locked,
  install,
}: {
  state: Live
  actor: number
  locked: boolean
  install: (x: number) => void
}) {
  const pilot = state.players[actor]
  const [x, select] = useState(() =>
    Math.max(1, Math.min(23, pilot.x + (actor ? -3 : 3))),
  )
  const { box, reason } = planBarrier(state, actor, x)
  const count = state.boxes.filter((b) => b.owner === actor).length
  const land = maps[state.map].land
  const color = reason ? '#ff988a' : '#8af0be'
  return (
    <fieldset className="barrier-planner">
      <legend>Barrier placement</legend>
      <div className="barrier-readout">
        <b>x = {x.toFixed(1)}</b>
        <span>
          {count}/{barrierLimit} deployed
        </span>
      </div>
      <svg
        viewBox="0 0 240 98"
        preserveAspectRatio="none"
        aria-hidden="true"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          select(
            Math.max(
              1,
              Math.min(
                23,
                Math.round(((e.clientX - rect.left) / rect.width) * 48) / 2,
              ),
            ),
          )
        }}
      >
        <path
          d={
            'M0 92 ' +
            land.map((p) => 'L' + p.x * 10 + ' ' + (82 - p.y * 8)).join(' ') +
            ' L240 92Z'
          }
          fill="#526078"
        />
        {state.boxes.map((b) => (
          <rect
            key={b.id}
            x={b.x * 10}
            y={82 - (b.y + b.h) * 8}
            width={b.w * 10}
            height={b.h * 8}
            fill={b.owner === actor ? '#a6c8ee' : '#a18f9e'}
          />
        ))}
        {state.players.map((p, i) => (
          <circle
            key={i}
            cx={p.x * 10}
            cy={82 - p.y * 8}
            r="5"
            fill={i === actor ? '#8fe4ec' : '#ff978d'}
          />
        ))}
        <path d={`M${x * 10} 8V90`} stroke={color} strokeDasharray="2 3" />
        <rect
          x={box.x * 10}
          y={82 - (box.y + box.h) * 8}
          width={box.w * 10}
          height={box.h * 8}
          fill={color}
          fillOpacity=".4"
          stroke={color}
        />
      </svg>
      <label>
        Barrier position
        <input
          type="range"
          min="1"
          max="23"
          step=".5"
          value={x}
          onChange={(e) => select(+e.target.value)}
        />
      </label>
      <small>
        {reason ||
          'Tap the map or use the slider. Place within 9 units of your tank.'}
      </small>
      <button
        className="secondary"
        disabled={locked || !!reason || pilot.energy < barrierCost}
        onClick={() => install(x)}
      >
        Install barrier · {barrierCost} ⚡
      </button>
    </fieldset>
  )
}
