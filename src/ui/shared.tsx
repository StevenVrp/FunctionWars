import { useEffect, useRef } from 'react'
import { read, write } from '../data/storage'
export interface Settings {
  muted: boolean
  volume: number
  speed: number
  reduce: boolean
  grid: boolean
}
export const defaults: Settings = {
  muted: true,
  volume: 0.4,
  speed: 1,
  reduce:
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches,
  grid: true,
}
let audio: AudioContext | undefined
export function sound(
  kind:
    | 'button'
    | 'valid'
    | 'launch'
    | 'impact'
    | 'damage'
    | 'turn'
    | 'win'
    | 'lose'
    | 'shift'
    | 'wall'
    | 'boost'
    | 'nuke'
    | 'bank'
    | 'auto'
    | 'shield'
    | 'shatter'
    | 'move'
    | 'pulse',
  settings: Settings,
) {
  if (settings.muted || !settings.volume) return
  const pitch = {
    button: [320],
    valid: [430, 600],
    launch: [160, 430],
    impact: [95, 55],
    damage: [120, 82],
    turn: [340, 460],
    win: [440, 550, 660],
    lose: [320, 230, 150],
    shift: [110, 220, 330, 165],
    wall: [130, 90, 70],
    boost: [220, 440, 880],
    nuke: [150, 75, 40, 30],
    bank: [480, 640, 800],
    auto: [840, 560, 840],
    shield: [660, 780, 660],
    shatter: [940, 360, 120],
    move: [140, 190],
    pulse: [300, 450, 600],
  }[kind]
  try {
    audio ??= new AudioContext()
    void audio.resume().catch(() => {})
    pitch.forEach((hz, i) => {
      const o = audio!.createOscillator(),
        g = audio!.createGain(),
        t = audio!.currentTime + i * 0.085
      o.type = ['nuke', 'wall', 'shatter', 'impact'].includes(kind)
        ? 'sawtooth'
        : 'sine'
      o.frequency.setValueAtTime(hz, t)
      g.gain.setValueAtTime(0.07 * settings.volume, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      o.connect(g)
      g.connect(audio!.destination)
      o.start(t)
      o.stop(t + 0.16)
    })
  } catch {
    /* Audio may be unavailable. */
  }
}
export function Icon({ name, size = 21 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3z',
    duel: 'm3 3 4 1 10 10-3 3L4 7z M4 20l4-4m-5-1 5 5m8-3 4 4m-1-7-5 5 M14 8l4-4 3-1-1 4-4 4',
    campaign: 'M3 17 9 5l5 8 3-5 5 11H2z',
    sandbox: 'M9 2h6m-5 1v7L4 20q0 1 2 1h13q2 0 1-2l-6-9V3 M7 15h11',
    library: 'M3 4h4v16H3z M10 4h3v16h-3z M16 5l3-1 4 15-3 1z',
    settings: 'M4 6h16M4 12h16M4 18h16 M9 3v6m7 0v6m-7 0v6',
    arrow: 'M4 12h15m-6-6 6 6-6 6',
    cross: 'M12 2v5m0 10v5M2 12h5m10 0h5 M12 5a7 7 0 1 1-.01 0',
    back: 'M20 12H5m6-6-6 6 6 6',
    sound: 'M3 9h4l5-5v16l-5-5H3z M16 8q4 4 0 8m2-11q7 7 0 14',
    mute: 'M3 9h4l5-5v16l-5-5H3z M16 9l6 6m0-6-6 6',
    book: 'M3 4q5-1 9 2 4-3 9-2v15q-5-1-9 2-4-3-9-2z M12 6v15',
    play: 'M7 4l13 8-13 8z',
    target: 'M12 3a9 9 0 1 1-.01 0 M12 7a5 5 0 1 1-.01 0 M12 11v2',
    save: 'M3 3h15l3 3v15H3z M7 3v6h9V3 M7 21v-8h10v8',
    close: 'm5 5 14 14m0-14L5 19',
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.cross} />
    </svg>
  )
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string
  close: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
    return () => ref.current?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="iconbtn" aria-label="Close" onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function SettingsPanel({
  value,
  set,
}: {
  value: Settings
  set: (s: Settings) => void
}) {
  function change<K extends keyof Settings>(k: K, v: Settings[K]) {
    const next = { ...value, [k]: v }
    set(next)
    try {
      write('settings', next)
    } catch {
      /* session settings remain usable */
    }
  }
  return (
    <div className="settings">
      <label>
        Sound effects
        <input
          type="checkbox"
          checked={!value.muted}
          onChange={(e) => change('muted', !e.target.checked)}
        />
      </label>
      <label>
        Volume
        <input
          aria-label="Volume"
          type="range"
          min="0"
          max="1"
          step=".05"
          value={value.volume}
          onChange={(e) => change('volume', +e.target.value)}
        />
      </label>
      <label>
        Animation speed
        <select
          value={value.speed}
          onChange={(e) => change('speed', +e.target.value)}
        >
          <option value=".5">0.5×</option>
          <option value="1">1×</option>
          <option value="2">2×</option>
        </select>
      </label>
      <label>
        Reduced motion
        <input
          type="checkbox"
          checked={value.reduce}
          onChange={(e) => change('reduce', e.target.checked)}
        />
      </label>
      <label>
        Coordinate grid
        <input
          type="checkbox"
          checked={value.grid}
          onChange={(e) => change('grid', e.target.checked)}
        />
      </label>
    </div>
  )
}
export function loadSettings() {
  return { ...defaults, ...read<Partial<Settings>>('settings', {}) }
}
