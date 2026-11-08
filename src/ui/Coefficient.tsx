import { useEffect, useState } from 'react'
import type { Control } from '../math/ast'
export function Coefficient({
  control,
  index,
  set,
}: {
  control: Control
  index: string
  set: (v: number) => void
}) {
  const c = control,
    [draft, setDraft] = useState(String(c.value)),
    [editing, setEditing] = useState(false)
  const [range, setRange] = useState<[number, number]>([c.min, c.max]),
    [showBounds, setShowBounds] = useState(false)
  useEffect(() => {
    if (!editing) setDraft(String(c.value))
  }, [c.value, editing])
  const min = Math.min(range[0], c.value),
    max = Math.max(range[1], c.value)
  function commit() {
    const n = Number(draft)
    if (draft.trim() && Number.isFinite(n) && n !== c.value)
      set(Math.max(c.min, Math.min(c.max, n)))
    setEditing(false)
  }
  return (
    <>
      <div className="slider-row">
        <label htmlFor={'s' + index}>{c.label}</label>
        <input
          id={'s' + index}
          type="range"
          min={min}
          max={max}
          step=".01"
          value={c.value}
          onChange={(e) => set(+e.target.value)}
        />
        <input
          type="number"
          aria-label={c.label + ' value'}
          min={c.min}
          max={c.max}
          step=".01"
          value={editing ? draft : c.value}
          onFocus={() => {
            setDraft(String(c.value))
            setEditing(true)
          }}
          onChange={(e) => {
            setDraft(e.target.value)
            const n = e.target.valueAsNumber
            if (Number.isFinite(n) && n >= c.min && n <= c.max) set(n)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
      </div>
      <button
        type="button"
        className="range-toggle"
        onClick={() => setShowBounds(!showBounds)}
        aria-expanded={showBounds}
      >
        {showBounds ? 'Close bounds' : 'Range ' + min + ' … ' + max}
      </button>
      {showBounds && (
        <div className="range-bounds">
          <label>
            Min
            <input
              type="number"
              aria-label={c.label + ' minimum'}
              min={c.min}
              max={Math.min(c.value, max - 0.01)}
              step=".01"
              value={min}
              onChange={(e) => {
                const v = e.target.valueAsNumber
                if (Number.isFinite(v) && v >= c.min && v < max && v <= c.value)
                  setRange([v, max])
              }}
            />
          </label>
          <label>
            Max
            <input
              type="number"
              aria-label={c.label + ' maximum'}
              min={Math.max(c.value, min + 0.01)}
              max={c.max}
              step=".01"
              value={max}
              onChange={(e) => {
                const v = e.target.valueAsNumber
                if (Number.isFinite(v) && v <= c.max && v > min && v >= c.value)
                  setRange([min, v])
              }}
            />
          </label>
        </div>
      )}
    </>
  )
}
