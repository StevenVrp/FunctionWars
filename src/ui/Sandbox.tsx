import { useState } from 'react'
import { Editor, useEditor } from './Editor'
import { Board, type Overlay } from './Board'
import { Icon, Modal, sound, type Settings } from './shared'
import { record, type Saved } from '../data/storage'
import type { Point } from '../math/weapon'
import { useFlight } from './flight'
import type { Projectile } from '../combat/state'
import { resolvePath } from '../combat/collision'
const curveStyles = [
  { label: 'Curve A', color: '#69eadb', dash: undefined },
  { label: 'Curve B', color: '#ffc186', dash: '8 4' },
  { label: 'Curve C', color: '#ee89bd', dash: '2 4' },
]

export function Sandbox({
  settings,
  save,
  loaded,
}: {
  settings: Settings
  save: (s: Saved) => void
  loaded?: Saved
}) {
  const ed = useEditor(loaded?.source, loaded?.parameters),
    [overlays, setOverlays] = useState<Overlay[]>([]),
    [impact, setImpact] = useState<Point | null>(null),
    [name, setName] = useState(''),
    [saving, setSaving] = useState(false),
    [status, setStatus] = useState(''),
    [flight, setFlight] = useState<Projectile | null>(null)
  const origin = { x: 2, y: 1 },
    ready = !!ed.weapon && !ed.error && !ed.busy && !flight
  const shot = useFlight(flight, settings, () => {
    if (!flight) return
    const hit = flight.hit
    setImpact(hit.point)
    setFlight(null)
    sound('impact', settings)
    setStatus(
      'Impact at (' +
        hit.point.x.toFixed(2) +
        ', ' +
        hit.point.y.toFixed(2) +
        ') · ' +
        hit.kind,
    )
  })
  function fire() {
    if (!ready || !ed.weapon) return
    try {
      const result = resolvePath(ed.weapon, origin, 1, [], [])
      setImpact(null)
      setStatus('Projectile in flight')
      sound('launch', settings)
      setFlight({ w: ed.weapon, start: origin, dir: 1, hit: result })
    } catch (err) {
      setStatus((err as Error).message)
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker mint">FREE EXPERIMENT</span>
          <h1>Function Sandbox</h1>
        </div>
        <button
          className="secondary"
          disabled={!ready}
          onClick={() => {
            setName('')
            setSaving(true)
          }}
        >
          <Icon name="save" />
          Save weapon
        </button>
      </div>
      <div className="workspace">
        <section className="panel scene">
          <div className="scene-head">
            <b>Trajectory laboratory</b>
            <span>LIVE PLOT</span>
          </div>
          <Board
            weapon={ed.weapon}
            lab
            overlays={overlays}
            shot={shot}
            impact={impact}
            showGrid={settings.grid}
          />
          <div className="scene-controls">
            <button
              className="secondary"
              disabled={!ready || overlays.length >= 3}
              onClick={() => {
                const style = curveStyles.find(
                  (candidate) =>
                    !overlays.some((curve) => curve.label === candidate.label),
                )
                if (ed.weapon && style) {
                  setOverlays([...overlays, { w: ed.weapon, ...style }])
                  setStatus(style.label + ' pinned.')
                }
              }}
            >
              ＋ Pin overlay
            </button>
            <span className="muted">
              {overlays.length}/3 overlays · Drag to pan
            </span>
          </div>
          {overlays.map((curve) => (
            <div
              className="overlay"
              key={curve.label}
              style={{ color: curve.color }}
            >
              <div className="overlay-info">
                <strong>
                  <svg aria-hidden="true" width="28" height="8">
                    <path
                      d="M0 4H28"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={curve.dash}
                    />
                  </svg>
                  {curve.label}
                </strong>
                <code>{curve.w.source}</code>
                <small>
                  {curve.w.controls
                    .filter((c) => c.start === undefined)
                    .map((c) => c.label + ' = ' + c.value)
                    .join(' · ')}
                </small>
              </div>
              <div className="overlay-actions">
                <button
                  aria-label={'Restore ' + curve.label}
                  disabled={!!flight}
                  onClick={() => {
                    ed.load(curve.w.source, curve.w.parameters)
                    setImpact(null)
                    setStatus(curve.label + ' restored to the editor.')
                  }}
                >
                  Restore
                </button>
                <button
                  aria-label={'Remove ' + curve.label}
                  onClick={() =>
                    setOverlays(
                      overlays.filter((other) => other.label !== curve.label),
                    )
                  }
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <div className="feedback" role="status">
            {status || 'Edit a coefficient to change the dotted trajectory.'}
          </div>
        </section>
        <Editor ed={ed} settings={settings} locked={!!flight}>
          <button className="primary wide" disabled={!ready} onClick={fire}>
            <Icon name="cross" />
            Fire trajectory
          </button>
        </Editor>
      </div>
      {saving && (
        <Modal title="Save weapon" close={() => setSaving(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (ed.weapon) {
                try {
                  save(record(ed.weapon, name))
                  setStatus('Saved to your weapon library.')
                  setSaving(false)
                } catch (err) {
                  setStatus((err as Error).message)
                  setSaving(false)
                }
              }
            }}
          >
            <label>
              Weapon name
              <input
                autoFocus
                required
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name this trajectory"
              />
            </label>
            <button className="primary">Save to library</button>
          </form>
        </Modal>
      )}
    </>
  )
}
