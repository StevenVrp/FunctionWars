import { useState } from 'react'
import { puzzles, puzzleRule, type Puzzle } from '../data/puzzles'
import { read, write, type Saved } from '../data/storage'
import { Board } from './Board'
import { Editor, useEditor } from './Editor'
import { Icon, Modal, sound, type Settings } from './shared'
import { LoadSaved } from './LoadSaved'
import { useFlight } from './flight'
import { mission, missionReduce } from '../combat/mission'
function starText(n: number) {
  return '★'.repeat(n) + '☆'.repeat(3 - n)
}
export function Campaign({
  settings,
  items,
}: {
  settings: Settings
  items: Saved[]
}) {
  const [level, setLevel] = useState(0),
    [attempt, setAttempt] = useState(0),
    [progress, setProgress] = useState(() =>
      read<Record<string, number>>('progress', {}),
    ),
    [notice, setNotice] = useState('')
  const completed = puzzles.filter((p) => progress[p.id] > 0).length
  if (level)
    return (
      <PuzzlePlay
        key={level + '-' + attempt}
        p={puzzles[level - 1]}
        settings={settings}
        items={items}
        back={() => setLevel(0)}
        restart={() => setAttempt((a) => a + 1)}
        next={() => setLevel(level < puzzles.length ? level + 1 : 0)}
        onWin={(n) => {
          const a = { ...progress, [level]: Math.max(progress[level] || 0, n) }
          setProgress(a)
          try {
            write('progress', a)
          } catch {
            setNotice('Progress is available for this session only.')
          }
        }}
      />
    )
  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker violet">SINGLE PLAYER</span>
          <h1>Puzzle Campaign</h1>
        </div>
        <span className="mono">
          {completed} / {puzzles.length} cleared
        </span>
      </div>
      <div className="campaign-intro panel">
        <Icon name="campaign" size={42} />
        <div>
          <h2>Select a mission</h2>
          <p>
            Hit the beacon within the shot budget. Earn extra stars for
            efficiency and precision.
          </p>
        </div>
      </div>
      {notice && <p role="status">{notice}</p>}
      <div className="missions">
        {puzzles.map((p) => (
          <button key={p.id} className="mission" onClick={() => setLevel(p.id)}>
            <div>
              <span className="kicker">
                MISSION {String(p.id).padStart(2, '0')}
              </span>
              <span className="stars">
                {starText(Math.min(3, Math.max(0, progress[p.id] || 0)))}
              </span>
            </div>
            <h2>{p.name}</h2>
            <p>{p.concept}</p>
            <div>
              <small>{p.difficulty}</small>
              <Icon name="arrow" />
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
function PuzzlePlay({
  p,
  settings,
  items,
  back,
  restart,
  next,
  onWin,
}: {
  p: Puzzle
  settings: Settings
  items: Saved[]
  back: () => void
  restart: () => void
  next: () => void
  onWin: (n: number) => void
}) {
  const ed = useEditor(p.starter, {}),
    [state, setState] = useState(() => mission(p, 'mission-' + p.id)),
    [hint, setHint] = useState(false),
    [error, setError] = useState('')
  const { shots, outcome: result, projectile: flight } = state
  const impact = state.lastHit?.point,
    feedback =
      error || (flight ? 'Shot in flight.' : (state.history.at(-1) ?? ''))
  const rule = ed.weapon ? puzzleRule(p, ed.weapon) : '',
    ready =
      ed.weapon && !ed.busy && !ed.error && !rule && state.phase === 'planning'
  const shot = useFlight(flight, settings, () => {
    const next = missionReduce(state, { type: 'RESOLVE_SHOT' })
    setState(next)
    sound('impact', settings)
    if (next.outcome !== null) {
      if (next.outcome > 0) onWin(next.outcome)
      sound(next.outcome ? 'win' : 'lose', settings)
    }
  })
  function fire() {
    if (!ready || !ed.weapon) return
    try {
      setState(
        missionReduce(state, {
          type: 'FIRE',
          source: ed.weapon.source,
          parameters: ed.weapon.parameters,
        }),
      )
      setError('')
      sound('launch', settings)
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker violet">
            MISSION {String(p.id).padStart(2, '0')} / {puzzles.length}
          </span>
          <h1>{p.name}</h1>
        </div>
        <button className="secondary" onClick={back}>
          <Icon name="back" />
          Missions
        </button>
      </div>
      <div className="workspace">
        <section className="panel scene">
          <div className="scene-head">
            <b>{p.concept}</b>
            <span>{p.budget - shots} SHOTS LEFT</span>
          </div>
          <Board
            weapon={ed.weapon}
            origin={p.origin}
            players={[p.origin]}
            targets={[p.target]}
            boxes={p.boxes}
            gate={p.gate}
            shot={shot}
            impact={impact}
            showGrid={settings.grid}
          />
          <div className="mission-brief">
            <h3>Objective</h3>
            <p>{p.objective}</p>
            <small>
              Allowed: {p.allowed.join(', ')} · Par {p.par} · Precision ≤{' '}
              {p.precision}
            </small>
            <div className="action-row">
              <button className="secondary" onClick={() => setHint(!hint)}>
                {hint ? 'Hide hint' : 'Show hint'}
              </button>
              <button className="text-btn" onClick={restart}>
                Restart mission
              </button>
            </div>
            {hint && <p className="hint">{p.hint}</p>}
          </div>
          <div className="feedback" role="status">
            {feedback || 'Align your curve with the orange beacon.'}
          </div>
        </section>
        <Editor ed={ed} settings={settings} locked={!!flight}>
          <LoadSaved
            items={items}
            load={(s) => ed.load(s.source, s.parameters)}
            disabled={!!flight}
          />
          {rule && <small className="bad">{rule}</small>}
          <button className="primary wide" disabled={!ready} onClick={fire}>
            <Icon name="cross" />
            Fire trajectory
          </button>
        </Editor>
      </div>
      {result !== null && (
        <Modal title={result ? 'Mission cleared' : 'Out of shots'} close={back}>
          {result > 0 ? (
            <>
              <div className="result-stars">{starText(result)}</div>
              <p>
                {shots} shot{shots === 1 ? '' : 's'} · {p.name}
              </p>
            </>
          ) : (
            <p>{feedback}</p>
          )}
          <div className="action-row">
            <button className="secondary" onClick={restart}>
              Retry mission
            </button>
            {result > 0 && (
              <button className="primary" onClick={next}>
                {p.id < puzzles.length ? 'Next mission' : 'Mission select'}
                <Icon name="arrow" />
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
