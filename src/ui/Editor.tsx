import { Coefficient } from './Coefficient'
import { sound, type Settings } from './shared'
import { useEffect, useRef, useState, useId } from 'react'
import { printSource, type Parameters, type Expr } from '../math/ast'
import { compile, type Weapon } from '../math/weapon'
export const PRESETS = [
  ['Parabola', 'a*u*(1-u/20)', { a: 1.25 }],
  ['Sine', 'a*sin(b*u)', { a: 3, b: 0.28 }],
  ['Linear', 'a*u', { a: 0.4 }],
  ['Composite', 'sin(0.2*u^2)+ln(u+1)', {}],
  ['Absolute', 'abs(u-6)', {}],
  ['Logarithm', '2*ln(u+1)', {}],
] as [string, string, Parameters][]
export function useEditor(
  initial = PRESETS[0][1],
  params: Parameters = PRESETS[0][2],
) {
  const [source, setSource] = useState(initial),
    [parameters, setParameters] = useState(params),
    [weapon, setWeapon] = useState<Weapon | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true)
  const worker = useRef<Worker | null>(null),
    direct = useRef(window.__fwStandalone || location.protocol === 'file:'),
    request = useRef(0)
  useEffect(
    () => () => {
      worker.current?.terminate()
      worker.current = null
    },
    [],
  )
  useEffect(() => {
    let live = true,
      pending = false
    const id = ++request.current
    setBusy(true)
    setError('')
    const timeout = window.setTimeout(() => {
      function validateDirectly() {
        if (!live || request.current !== id) return
        pending = false
        direct.current = true
        worker.current?.terminate()
        worker.current = null
        try {
          setWeapon(compile(source, parameters))
          setError('')
        } catch (error) {
          setError((error as Error).message)
        }
        setBusy(false)
      }
      if (direct.current) return validateDirectly()
      try {
        worker.current ??= new Worker(
          new URL('../math/worker.ts', import.meta.url),
          { type: 'module' },
        )
        const w = worker.current
        w.onmessage = (e) => {
          if (!live || e.data.id !== id) return
          pending = false
          setBusy(false)
          if (e.data.error) setError(e.data.error)
          else {
            setWeapon(e.data.weapon)
            setError('')
          }
        }
        w.onerror = (event) => {
          event.preventDefault()
          validateDirectly()
        }
        w.onmessageerror = validateDirectly
        pending = true
        w.postMessage({ id, source, params: parameters })
      } catch {
        validateDirectly()
      }
    }, 55)
    return () => {
      live = false
      clearTimeout(timeout)
      if (pending) {
        worker.current?.terminate()
        worker.current = null
      }
    }
  }, [source, parameters])
  function load(s: string, p: Parameters = {}) {
    if (s === source && JSON.stringify(p) === JSON.stringify(parameters)) return
    setBusy(true)
    setSource(s)
    setParameters(p)
  }
  return {
    source,
    parameters,
    weapon,
    error,
    busy,
    load,
    setSource: (s: string) => {
      if (s === source) return
      setBusy(true)
      setSource(s)
    },
    setParameters: (p: Parameters) => {
      if (JSON.stringify(p) === JSON.stringify(parameters)) return
      setBusy(true)
      setParameters(p)
    },
  }
}
function notation(a: Expr, precedence = 0): React.ReactNode {
  if (!a.args.length) return a.name ?? a.value ?? 'u'
  if (a.op === 'neg') return <>−{notation(a.args[0], 3)}</>
  if (a.args.length === 1)
    return (
      <>
        {a.op}({notation(a.args[0])})
      </>
    )
  const p = a.op === '^' ? 4 : a.op === '*' || a.op === '/' ? 2 : 1
  const v =
    a.op === '^' ? (
      <>
        {notation(a.args[0], 5)}
        <sup>{notation(a.args[1])}</sup>
      </>
    ) : (
      <>
        {notation(a.args[0], p)}
        {
          (
            { '*': ' · ', '/': ' / ', '+': ' + ', '-': ' − ' } as Record<
              string,
              string
            >
          )[a.op]
        }
        {notation(a.args[1], p + 1)}
      </>
    )
  return precedence > p ? <>({v})</> : v
}
export type EditorState = ReturnType<typeof useEditor>
export function Editor({
  ed,
  locked = false,
  children,
  settings,
  duelStats,
}: {
  settings: Settings
  duelStats?: { damage: number; reload: number; interval: number }
  ed: EditorState
  locked?: boolean
  children?: React.ReactNode
}) {
  const inputId = useId()
  const w = ed.weapon,
    valid = w && !ed.busy && !ed.error
  const previous = useRef('')
  useEffect(() => {
    if (valid) {
      if (previous.current && previous.current !== w.canonical)
        sound('valid', settings)
      previous.current = w.canonical
    }
  }, [valid, w, settings])
  return (
    <aside className="editor panel">
      <div className="panel-head">
        <span className="kicker">TRAJECTORY CONTROL</span>
        <span className="small-icon">ƒ</span>
      </div>
      <h2>Equation editor</h2>
      <fieldset disabled={locked}>
        <label htmlFor={inputId}>Function input</label>
        <div className="equation-input">
          <span>ƒ(u) =</span>
          <input
            id={inputId}
            spellCheck={false}
            autoComplete="off"
            value={ed.source}
            onChange={(e) => ed.setSource(e.target.value)}
          />
        </div>
        <div className={'validation ' + (ed.error ? 'bad' : '')} role="status">
          {ed.error || (ed.busy ? 'Analyzing…' : '●  Valid trajectory')}
        </div>
        <label className="preset-label">
          Load template{' '}
          <select
            aria-label="Load template"
            value=""
            onChange={(e) => {
              const p = PRESETS[Number(e.target.value)]
              ed.load(p[1], p[2])
            }}
          >
            <option value="">Choose function</option>
            {PRESETS.map(([n], i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {w && (
          <>
            <div className="notation" aria-label="Resolved equation">
              ƒ(u) = {notation(w.bound)}
            </div>
            {w.controls.length > 0 && (
              <div className="slider-group">
                <div className="kicker">COEFFICIENTS</div>
                {w.controls.map((c, i) => {
                  const set = (v: number) => {
                    if (!Number.isFinite(v)) return
                    v = Math.max(c.min, Math.min(c.max, v))
                    if (c.start !== undefined)
                      ed.setSource(
                        printSource(w.tree, { id: c.start, value: v }),
                      )
                    else ed.setParameters({ ...ed.parameters, [c.key]: v })
                  }
                  return (
                    <Coefficient
                      key={c.key}
                      control={c}
                      index={inputId + i}
                      set={set}
                    />
                  )
                })}
              </div>
            )}
            <div className={'tier tier' + w.tier}>
              <div>
                <span className="kicker">WEAPON CLASS</span>
                <strong>
                  Tier {w.stats.roman} · {w.stats.name}
                </strong>
                <small>
                  {w.families.join(' + ')}
                  {w.nested ? ' · Composite' : ''} · {w.score}/12
                </small>
              </div>
            </div>
            <div className="statline">
              {[
                [
                  'Damage',
                  Math.round(w.stats.damage * (duelStats?.damage ?? 1)),
                ],
                ['Energy', w.stats.cost],
                [
                  'Cooldown',
                  duelStats
                    ? Math.round(
                        Math.max(0.5, w.stats.cooldown * duelStats.interval) *
                          duelStats.reload *
                          100,
                      ) /
                        100 +
                      's'
                    : w.stats.cooldown + '× refill',
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <b>{v}</b>
                  <small>{k}</small>
                </div>
              ))}
            </div>
          </>
        )}
      </fieldset>
      {children}
      {!valid && ed.error && (
        <small>Preview retains the last valid equation.</small>
      )}
    </aside>
  )
}
