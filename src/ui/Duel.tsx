import { BattleScene } from './BattleScene'
import { tanks, selectTank, type TankId } from '../combat/tanks'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  act,
  advance,
  startLive,
  powers,
  defaultSetup,
  type Live,
  type Action,
  type Setup,
} from '../combat/live'
import { maps } from '../combat/maps'
import { compile, type Weapon } from '../math/weapon'
import type { Saved } from '../data/storage'
import { roomRequest, type Room } from '../online/client'
import { Editor, PRESETS, useEditor } from './Editor'
import { LoadSaved } from './LoadSaved'
import { Board } from './Board'
import { Cloud } from './Cloud'
import { art } from './assets'
import { sound, Modal, Icon, type Settings } from './shared'
const roman = ['I', 'II', 'III', 'IV']
const presetOptions = PRESETS.map(([name, source, p]) => ({
  name,
  canonical: compile(source, p).canonical,
}))
function Garage({
  selected,
  choose,
  label,
}: {
  selected: TankId
  choose: (id: TankId) => void
  label: string
}) {
  return (
    <fieldset className="garage">
      <legend>{label}</legend>
      <div className="garage-row">
        {Object.entries(tanks).map(([id, t]) => (
          <button
            type="button"
            key={id}
            aria-pressed={selected === id}
            onClick={() => choose(id as TankId)}
            style={{ '--chassis': t.color } as React.CSSProperties}
          >
            <img src={art(t.sprite)} alt="" />
            <b>{t.name}</b>
            <small>{t.role}</small>
            <span>
              {Math.round(t.damage * 100)}% damage ·{' '}
              {Math.round(t.reload * 100)}% reload time
            </span>
            <em>{t.special.name}</em>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
export function Duel({
  settings,
  items,
}: {
  settings: Settings
  items: Saved[]
}) {
  const [mode, setMode] = useState(()=>sessionStorage.getItem('fw-confirmation')?'online':'offline'),
    [names, setNames] = useState(['Nova', 'Vega']),
    [cfg, configure] = useState<Setup>(defaultSetup),
    [picked, pick] = useState<[TankId, TankId]>(['vector', 'bastion']),
    [state, setState] = useState<Live | null>(null),
    [now, clock] = useState(Date.now),
    [room, setRoom] = useState<Room | null>(null),
    [uid, setUid] = useState(''),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [weapons, setWeapons] = useState<(Weapon | null)[]>([null, null])
  const live = useRef<Live | null>(null),
    offset = useRef(0),
    roomCode = useRef(''),
    version = useRef(-1),
    sending = useRef(false),
    seq = useRef(0)
  const preview = useCallback(
    (i: number, w: Weapon | null) =>
      setWeapons((old) =>
        old[i] === w ? old : old.map((x, j) => (j === i ? w : x)),
      ),
    [],
  )
  const sync = useCallback((r: Room) => {
    if (r.code !== roomCode.current || r.version < version.current) return
    version.current = r.version
    offset.current = r.now - Date.now()
    setRoom(r)
    live.current = r.state
    setState(r.state)
    clock(r.now)
  }, [])
  const account = useCallback((id: string) => setUid(id), [])
  const change = (v: Partial<Setup>) => configure({ ...cfg, ...v })
  function clear() {
    roomCode.current = ''
    version.current = -1
    live.current = null
    setState(null)
    setRoom(null)
    seq.current = 0
    setError('')
    setWeapons([null, null])
    offset.current = 0
  }
  async function connect(op: 'create' | 'join') {
    setBusy(true)
    setError('')
    try {
      const r = await roomRequest({
        op,
        code: code.trim().toLowerCase(),
        setup: cfg,
        tank: picked[0],
      })
      roomCode.current = r.code
      version.current = -1
      sync(r)
      try {
        localStorage.setItem('fw-room-' + uid, r.code)
      } catch {}
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    if (!room?.code || state?.result) return
    let alive = true,
      handle = 0
    async function poll() {
      try {
        const r = await roomRequest({ op: 'read', code: room!.code })
        if (alive) sync(r)
      } catch (e) {
        if (alive) setError((e as Error).message)
      }
      if (alive) handle = window.setTimeout(poll, 700)
    }
    handle = window.setTimeout(poll, 350)
    return () => {
      alive = false
      clearTimeout(handle)
    }
  }, [room?.code, state?.result, sync])
  useEffect(() => {
    if (!state || state.result) return
    const timer = setInterval(
      () => {
        const t = Date.now() + offset.current
        clock(t)
        if (mode === 'offline' && live.current) {
          live.current = advance(live.current, t)
          setState(live.current)
        }
      },
      settings.reduce ? 100 : 32,
    )
    return () => clearInterval(timer)
  }, [!!state, state?.result, mode, settings.reduce])
  useEffect(() => {
    if (!state) return
    for (const e of state.events.filter((e) => e.seq > seq.current)) {
      const kind =
        e.kind.startsWith('shield') || e.kind === 'block'
          ? 'shield'
          : ['repair', 'cycle', 'breach'].includes(e.kind)
            ? 'boost'
            : e.kind === 'sentry'
              ? 'auto'
              : e.kind
      sound(kind as Parameters<typeof sound>[0], settings)
      seq.current = e.seq
    }
  }, [state, settings])
  async function command(i: number, a: Action) {
    setError('')
    try {
      if (mode === 'online') {
        if (sending.current) return
        sending.current = true
        setBusy(true)
        try {
          sync(
            await roomRequest({
              op: 'act',
              code: room!.code,
              action: a,
              nonce: crypto.randomUUID(),
            }),
          )
        } finally {
          sending.current = false
          setBusy(false)
        }
      } else if (live.current) {
        const t = Date.now()
        live.current = act(live.current, i, a, t)
        setState(live.current)
        clock(t)
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const options = [
    ...presetOptions,
    ...items.map((s) => ({ name: s.name, canonical: s.canonical })),
  ].filter((o, i, a) => a.findIndex((v) => v.canonical === o.canonical) === i)
  if (!state)
    return (
      <>
        <div className="page-head">
          <div>
            <span className="kicker coral">SIMULTANEOUS ARTILLERY</span>
            <h1>Duel Arena</h1>
          </div>
        </div>
        {room ? (
          <div className="panel lobby">
            <h2>Waiting for the second pilot</h2>
            <p>
              Share room code <strong>{room.code}</strong>. Keep this screen
              open.
            </p>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  const r = await roomRequest({ op: 'cancel', code: room.code })
                  if ('cancelled' in r) clear()
                  else sync(r)
                } catch (e) {
                  setError((e as Error).message)
                }
              }}
            >
              Cancel room
            </button>
          </div>
        ) : (
          <>
            <div className="setup-controls panel">
              <div className="action-row">
                {['offline', 'online'].map((m) => (
                  <button
                    key={m}
                    className={mode === m ? 'primary' : 'secondary'}
                    onClick={() => {
                      setMode(m)
                      setError('')
                    }}
                  >
                    {m === 'online' ? 'Online room' : 'Local multiplayer'}
                  </button>
                ))}
              </div>
              {mode === 'online' && <Cloud onAccount={account} />}
              {mode === 'offline' && (
                <div className="action-row">
                  {names.map((n, i) => (
                    <label key={i}>
                      Pilot {i + 1}
                      <input
                        value={n}
                        maxLength={24}
                        onChange={(e) =>
                          setNames(
                            names.map((x, j) => (i === j ? e.target.value : x)),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              {(mode === 'online' ? [0] : [0, 1]).map((i) => (
                <Garage
                  key={i}
                  label={
                    mode === 'online'
                      ? 'Your tank'
                      : (names[i] || 'Pilot ' + (i + 1)) + ' · tank'
                  }
                  selected={picked[i]}
                  choose={(id) =>
                    pick(i === 0 ? [id, picked[1]] : [picked[0], id])
                  }
                />
              ))}
              <h2>Battlefield</h2>
              <div className="map-grid">
                {maps.map((m, i) => (
                  <button
                    key={m.title}
                    className={cfg.map === i ? 'chosen' : ''}
                    aria-pressed={cfg.map === i}
                    onClick={() => change({ map: i })}
                  >
                    <img src={art(m.art)} alt="" />
                    <span>{m.title}</span>
                  </button>
                ))}
              </div>
              <label>
                Refill 10 energy every{' '}
                <select
                  value={cfg.pulse}
                  onChange={(e) => change({ pulse: +e.target.value })}
                >
                  {[5, 8, 10, 15, 20].map((v) => (
                    <option key={v} value={v}>
                      {v} seconds
                    </option>
                  ))}
                </select>
              </label>
              <details>
                <summary>Weapon restrictions</summary>
                <h3>Forbidden tiers</h3>
                {roman.map((r, i) => (
                  <label key={r}>
                    <input
                      type="checkbox"
                      checked={cfg.bans.includes(i)}
                      onChange={(e) =>
                        change({
                          bans: e.target.checked
                            ? [...cfg.bans, i]
                            : cfg.bans.filter((v) => v !== i),
                        })
                      }
                    />{' '}
                    Tier {r}
                  </label>
                ))}
                <h3>Forbidden weapon designs</h3>
                {options.map((o) => (
                  <label key={o.canonical}>
                    <input
                      type="checkbox"
                      checked={cfg.blocked.includes(o.canonical)}
                      onChange={(e) =>
                        change({
                          blocked: e.target.checked
                            ? [...cfg.blocked, o.canonical]
                            : cfg.blocked.filter((v) => v !== o.canonical),
                        })
                      }
                    />{' '}
                    {o.name}
                  </label>
                ))}
              </details>
              {mode === 'offline' ? (
                <button
                  className="primary"
                  onClick={() => {
                    try {
                      const t = Date.now()
                      live.current = startLive(
                        { ...cfg, tanks: picked },
                        names,
                        t,
                      )
                      clock(t)
                      setState(live.current)
                      setError('')
                    } catch (e) {
                      setError((e as Error).message)
                    }
                  }}
                >
                  Start duel
                </button>
              ) : (
                <div className="action-row">
                  <button
                    disabled={!uid || busy}
                    className="primary"
                    onClick={() => connect('create')}
                  >
                    Create room
                  </button>
                  <input
                    aria-label="Room code"
                    value={code}
                    placeholder="12-character room code"
                    maxLength={12}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <button
                    className="secondary"
                    disabled={!uid || busy || code.length !== 12}
                    onClick={() => connect('join')}
                  >
                    Join / reconnect
                  </button>
                  {uid && (
                    <button
                      className="text-btn"
                      onClick={() => {
                        try {
                          setCode(localStorage.getItem('fw-room-' + uid) ?? '')
                        } catch {}
                      }}
                    >
                      Last room code
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        {error && (
          <p className="bad" role="alert">
            {error}
          </p>
        )}
      </>
    )
  const m = maps[state.map],
    seats = room ? [room.seat] : [0, 1],
    flying = state.flights.map((f) => ({
      ...f,
      u: Math.max(0, Math.min(f.hit.u, (now - f.from) * 0.012)),
    }))
  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker coral">
            {room ? 'ROOM ' + room.code : 'LOCAL MULTIPLAYER'}
          </span>
          <h1>{m.title}</h1>
        </div>
        <div className="turn-stat">
          <span>ENERGY REFILL</span>
          <b>{Math.max(0, Math.ceil((state.nextPulse - now) / 1000))}s</b>
          <small>
            Match · {Math.max(0, Math.ceil((state.deadline - now) / 1000))}s
          </small>
        </div>
      </div>
      <div className={'duel-console ' + (seats.length === 1 ? 'single' : '')}>
        <section className="panel live-field">
          <div className="hp-row">
            {state.players.map((p, i) => (
              <div className={'hp p' + i} key={i}>
                <span>
                  {p.name}
                  <small>
                    {p.hp} HP · {p.energy} ⚡
                  </small>
                </span>
                <progress
                  aria-label={p.name + ' health'}
                  value={p.hp}
                  max={100}
                />
                <small>
                  {[
                    p.shield === null ? '' : 'Ward ' + roman[p.shield],
                    p.bank ? 'Bank armed' : '',
                    p.auto ? 'Sentry armed' : '',
                    p.boost ? 'Overcharged' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </div>
            ))}
          </div>
          <div className="live-plot">
            <Board
              weapon={weapons[0]}
              origin={state.players[0]}
              players={state.players}
              boxes={state.boxes}
              backdrop={m.art}
              land={m.land}
              terrainTint={m.tint}
              battleScene={
                <BattleScene s={state} now={now} reduce={settings.reduce} />
              }
              extraShots={flying}
              enemyPreview={
                weapons[1]
                  ? { weapon: weapons[1], origin: state.players[1] }
                  : undefined
              }
              showGrid={settings.grid}
            />
          </div>
          <div className="feedback">
            {state.events.at(-1)?.text ?? 'Both pilots may fire immediately.'}
          </div>
        </section>
        {error && (
          <p className="bad" role="alert">
            {error}
          </p>
        )}
        <div className="stations">
          {seats.map((i) => (
            <Station
              key={i}
              i={i}
              state={state}
              settings={settings}
              items={items}
              now={now}
              busy={busy}
              preview={preview}
              command={command}
            />
          ))}
        </div>
      </div>
      {state.result && (
        <Modal title={state.result} close={clear}>
          <p>
            {state.players
              .map((p) => p.name + ' · ' + p.hp + ' HP')
              .join(' / ')}
          </p>
          <button className="primary" onClick={clear}>
            Match setup
          </button>
        </Modal>
      )}
    </>
  )
}
function Station({
  i,
  state,
  settings,
  items,
  now,
  busy,
  preview,
  command,
}: {
  i: number
  state: Live
  settings: Settings
  items: Saved[]
  now: number
  busy: boolean
  preview: (i: number, w: Weapon | null) => void
  command: (i: number, a: Action) => void
}) {
  const [tab, setTab] = useState('Targeting')
  const ed = useEditor(),
    p = state.players[i],
    tank = tanks[selectTank(p.tank)],
    w = ed.weapon,
    locked = !!state.result || busy
  useEffect(() => preview(i, w), [i, w, preview])
  const blocked = !!(
    w &&
    (state.setup.bans.includes(w.tier) ||
      state.setup.blocked.includes(w.canonical))
  )
  const cooling = w ? Math.max(0, Math.ceil((p.ready[w.tier] - now) / 1000)) : 0
  const fire =
    !!w &&
    !locked &&
    !ed.busy &&
    !ed.error &&
    !blocked &&
    !cooling &&
    p.energy >= w.stats.cost &&
    !state.flights.some((f) => f.actor === i)
  const trigger = () => {
    if (fire && w)
      command(i, { type: 'fire', source: w.source, parameters: w.parameters })
  }
  const fn = useRef(trigger)
  fn.current = trigger
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (!e.repeat && e.shiftKey && e.code === 'Digit' + (i + 1)) {
        e.preventDefault()
        fn.current()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [i])
  return (
    <section
      className="station console-card"
      style={{ '--chassis': tank.color } as React.CSSProperties}
    >
      <header className="station-head">
        <div>
          <small>
            PILOT {i + 1} · {tank.role}
          </small>
          <h2>{p.name}</h2>
          <b>{tank.name}</b>
        </div>
        <img src={art(tank.sprite)} alt={tank.name + ' tank'} />
      </header>
      <div className="station-resources">
        <span>
          <b>{p.hp}</b> HULL
        </span>
        <span>
          <b>{p.energy}</b> ENERGY
        </span>
        <kbd>Shift + {i + 1}</kbd>
      </div>
      <div className="launcher-controls">
        <button className="primary wide" disabled={!fire} onClick={trigger}>
          <Icon name="cross" />
          {blocked
            ? 'Weapon forbidden'
            : cooling
              ? 'Reload · ' + cooling + 's'
              : 'Fire trajectory'}
        </button>
        <div className="drive-controls">
          {[-1, 1].map((dx) => (
            <button
              key={dx}
              disabled={locked || p.energy < 2 || now < p.nextMove}
              onClick={() => command(i, { type: 'move', dx })}
            >
              {dx < 0 ? '← Drive' : 'Drive →'} <small>2 ⚡</small>
            </button>
          ))}
        </div>
      </div>
      <div className="console-switch">
        {['Targeting', 'Equipment'].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Targeting' ? (
        <Editor
          ed={ed}
          settings={settings}
          locked={locked}
          duelStats={{
            damage: tank.damage,
            reload: tank.reload,
            interval: state.setup.pulse,
          }}
        >
          <LoadSaved
            items={items.filter(
              (s) => !state.setup.blocked.includes(s.canonical),
            )}
            load={(s) => ed.load(s.source, s.parameters)}
          />
        </Editor>
      ) : (
        <div className="equipment-list">
          {[tank.special, ...powers].map((q) => (
            <button
              key={q.id}
              className={q === tank.special ? 'signature' : ''}
              disabled={
                locked ||
                p.energy < q.cost ||
                (q.id === 'auto' && state.setup.bans.includes(0))
              }
              onClick={() => command(i, { type: 'power', id: q.id })}
            >
              <span>
                <b>{q.name}</b>
                <small>{q.help}</small>
              </span>
              <em>{q.cost} ⚡</em>
            </button>
          ))}
        </div>
      )}
      <button
        className="station-concede"
        disabled={locked}
        onClick={() => command(i, { type: 'forfeit' })}
      >
        Concede match
      </button>
    </section>
  )
}
