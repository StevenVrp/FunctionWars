import { art } from './assets'
import { useEffect, useState } from 'react'
import { Sandbox } from './Sandbox'
import { Duel } from './Duel'
import { Campaign } from './Campaign'
import { Library } from './Library'
import { Icon, Modal, SettingsPanel, loadSettings, sound } from './shared'
import { decode, read, write, type Saved } from '../data/storage'
type Page = 'home' | 'duel' | 'campaign' | 'sandbox' | 'library'
const modes = [
  {
    id: 'duel',
    name: 'Duel Arena',
    type: 'LOCAL OR ONLINE · 2 PLAYERS',
    desc: 'Fire, maneuver, and deploy power-ups while both pilots race the energy clock.',
    color: 'coral',
  },
  {
    id: 'campaign',
    name: 'Puzzle Campaign',
    type: 'SOLO · 50 MISSIONS',
    desc: 'Plot a path through barriers and hit the beacon in fifty missions.',
    color: 'violet',
  },
  {
    id: 'sandbox',
    name: 'Function Sandbox',
    type: 'LAB · FREE PLAY',
    desc: 'Shape curves, compare trajectories, and save your own mathematical weapons.',
    color: 'mint',
  },
] as const
function ModeArt({ type }: { type: string }) {
  return (
    <svg
      className="mode-art"
      viewBox="0 0 130 66"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
    >
      <g opacity=".15" strokeWidth=".5">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={'M' + i * 16 + ' 0v66 M0 ' + i * 12 + 'h130'} />
        ))}
      </g>
      {type === 'duel' ? (
        <>
          <path d="M5 57Q61 -25 123 52" strokeDasharray="3 3" />
          <path d="m99 48 13-6 11 5-10 7z M8 58l13-7 12 5-12 8z" />
          <circle cx="67" cy="15" r="3" fill="currentColor" />
        </>
      ) : type === 'campaign' ? (
        <>
          <path
            d="m0 62 25-25 15 7 24-29 39 43 13-15 14 14 M40 43l14 6 10-34 18 35 M6 62l19-18 9 7"
            strokeWidth="1.5"
          />
          <circle cx="65" cy="13" r="4" />
        </>
      ) : (
        <>
          <path
            d="M1 38C19 38 17 11 32 11s14 46 31 46 15-45 32-45 17 33 35 23"
            strokeWidth="2"
          />
          <path d="M2 40Q66 0 128 42" strokeDasharray="3 4" />
          <circle cx="63" cy="57" r="3" fill="currentColor" />
        </>
      )}
    </svg>
  )
}
function Home({ go, manual }: { go: (p: Page) => void; manual: () => void }) {
  return (
    <>
      <section className="hero">
        <div className="hero-art" />
        <div className="hero-copy">
          <div className="hero-label">
            <i /> MATHEMATICAL ARTILLERY
          </div>
          <h1>
            FUNCTION
            <br />
            <em>WARS</em>
          </h1>
          <p>Construct. Analyze. Attack. Adapt.</p>
          <div className="hero-buttons">
            <button className="primary" onClick={() => go('duel')}>
              <Icon name="cross" size={18} />
              Launch duel
              <Icon name="arrow" size={17} />
            </button>
            <button className="hero-manual" onClick={manual}>
              <Icon name="book" size={17} />
              Field manual
            </button>
          </div>
        </div>
        <div className="hero-caption">
          <i /> ORBITAL TEST RANGE
        </div>
      </section>
      <div className="mode-heading">
        <div className="kicker violet">
          <i className="line" /> OPERATIONS
        </div>
        <div>
          <h2>Select a mode</h2>
        </div>
      </div>
      <div className="mode-grid">
        {modes.map((m) => (
          <button
            key={m.id}
            className={'mode-card ' + m.color}
            onClick={() => go(m.id)}
          >
            <div className="mode-main">
              <div className="mode-icon">
                <Icon name={m.id} size={26} />
              </div>
              <ModeArt type={m.id} />
            </div>
            <div className="card-content">
              <span className="kicker">{m.type}</span>
              <h3>{m.name}</h3>
              <p>{m.desc}</p>
            </div>
            <span className="card-enter">
              <Icon name="arrow" size={20} />
            </span>
          </button>
        ))}
      </div>
    </>
  )
}
function Manual() {
  return (
    <div className="manual">
      <p>
        Every shot begins at your rover. <b>u</b> is horizontal distance from
        launch, in either firing direction. The shot’s height is{' '}
        <code>y₀ + g(u) − g(0)</code>.
      </p>
      <h3>Try your first shot</h3>
      <p>
        In the sandbox, load the Parabola template. The second root at u = 20
        returns the shot to its launch height. Adjust <b>a</b> to lift the arc
        over a barrier, then fire.
      </p>
      <h3>Function grammar</h3>
      <p>
        Use explicit multiplication, parentheses, powers, and single-letter
        parameters. Try <code>a*sin(b*u)</code>, <code>sqrt(u+1)</code>, or{' '}
        <code>exp(0.1*u)+ln(u+1)</code>. Angles are radians. <code>log</code>{' '}
        and <code>ln</code> use base e. <code>log10</code> uses base 10.
      </p>
      <h3>Weapon tiers</h3>
      <table>
        <thead>
          <tr>
            {['Tier', 'Damage', 'Energy', 'Cooldown'].map((v) => (
              <th key={v}>{v}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ['I', 14, 2, 0],
            ['II', 24, 3, 1],
            ['III', 34, 4, 1],
            ['IV', 48, 6, 2],
          ].map((r) => (
            <tr key={r[0]}>
              {r.map((v, i) => (
                <td key={i}>
                  {v}
                  {i === 3 ? ' refills' : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Both pilots can fire at any time. Each refill restores 10 energy; a
        Capacitor carries up to 5 spare energy into the next refill. Use the Equipment map to place up to three barriers per pilot. Center hits deal 1.5×
        damage. Tier IV shots shatter the barrier they hit. After three minutes,
        remaining health decides the match.
      </p>
      <h3>Controls</h3>
      <p>
        Tab between controls. Use arrow keys on sliders and Enter on buttons. In
        the sandbox, drag the graph to pan and use + or − to zoom.
      </p>
    </div>
  )
}
function route(): Page {
  const p = location.hash.slice(1)
  return ['duel', 'campaign', 'sandbox', 'library'].includes(p)
    ? (p as Page)
    : 'home'
}
export function App() {
  const [page, setPage] = useState<Page>(route),
    [modal, setModal] = useState(''),
    [settings, setSettings] = useState(loadSettings),
    [loaded, setLoaded] = useState<Saved | undefined>(),
    [items, setItems] = useState<Saved[]>(() => {
      try {
        return decode({ version: 1, weapons: read('weapons', []) })
      } catch {
        return []
      }
    })
  function go(p: Page) {
    location.hash = p === 'home' ? 'home' : p
    setPage(p)
    scrollTo(0, 0)
    sound('button', settings)
  }
  useEffect(() => {
    const change = () => {
      setPage(route())
      scrollTo(0, 0)
    }
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])
  function update(next: Saved[]) {
    if (next.length > 100) throw Error('Library capacity is 100 weapons.')
    try {
      write('weapons', next)
    } catch {
      throw Error('Unable to save. Browser storage is unavailable or full.')
    }
    setItems(next)
  }
  useEffect(() => {
    document.documentElement.dataset.motion = settings.reduce
      ? 'reduced'
      : 'full'
  }, [settings.reduce])
  return (
    <>
      <header>
        <div className="bar">
          <button
            className="brand"
            onClick={() => go('home')}
            aria-label="Function Wars home"
          >
            <img src={art('mark.svg')} alt="" />
            <span>
              FUNCTION <b>WARS</b>
            </span>
          </button>
          <nav aria-label="Main navigation">
            <button
              className={page !== 'library' ? 'selected' : ''}
              onClick={() => go('home')}
            >
              Command center
            </button>
            <button
              className={page === 'library' ? 'selected' : ''}
              onClick={() => go('library')}
            >
              <Icon name="library" size={15} />
              Weapon library
            </button>
          </nav>
          <div className="header-tools">
            <button
              className="iconbtn"
              aria-label={settings.muted ? 'Unmute sound' : 'Mute sound'}
              onClick={() => {
                const s = { ...settings, muted: !settings.muted }
                setSettings(s)
                try {
                  write('settings', s)
                } catch {}
                sound('button', s)
              }}
            >
              <Icon name={settings.muted ? 'mute' : 'sound'} size={19} />
            </button>
            <button
              className="iconbtn"
              aria-label="Settings"
              onClick={() => setModal('settings')}
            >
              <Icon name="settings" size={20} />
            </button>
          </div>
        </div>
      </header>
      <main>
        {page !== 'home' && (
          <button className="breadcrumb" onClick={() => go('home')}>
            <Icon name="back" size={15} /> Command center
          </button>
        )}
        {page === 'home' ? (
          <Home go={go} manual={() => setModal('manual')} />
        ) : page === 'sandbox' ? (
          <Sandbox
            settings={settings}
            loaded={loaded}
            save={(s) => update([...items, s])}
          />
        ) : page === 'duel' ? (
          <Duel settings={settings} items={items} />
        ) : page === 'campaign' ? (
          <Campaign settings={settings} items={items} />
        ) : (
          <Library
            items={items}
            update={update}
            load={(s) => {
              setLoaded(s)
              go('sandbox')
            }}
          />
        )}
      </main>
      <footer>
        <span>
          <i /> LOCAL PLAY
        </span>
        <button onClick={() => setModal('manual')}>
          <Icon name="book" size={14} /> Field manual
        </button>
      </footer>
      {modal && (
        <Modal
          title={modal === 'settings' ? 'Settings' : 'Field manual'}
          close={() => setModal('')}
        >
          {modal === 'settings' ? (
            <SettingsPanel value={settings} set={setSettings} />
          ) : (
            <Manual />
          )}
        </Modal>
      )}
    </>
  )
}
