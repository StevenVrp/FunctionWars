import { Cloud } from './Cloud'
import { WeaponPlot } from './WeaponPlot'
import { useRef, useState } from 'react'
import { decode, type Saved } from '../data/storage'
import { Icon, Modal } from './shared'
export function Library({
  items,
  update,
  load,
}: {
  items: Saved[]
  update: (s: Saved[]) => void
  load: (s: Saved) => void
}) {
  const [showCloud, setShowCloud] = useState(false)
  const file = useRef<HTMLInputElement>(null),
    [message, setMessage] = useState(''),
    [editing, setEditing] = useState<Saved | null>(null),
    [name, setName] = useState('')
  function apply(a: Saved[]) {
    try {
      update(a)
      return true
    } catch (e) {
      setMessage((e as Error).message)
      return false
    }
  }
  function exp() {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify({ version: 1, weapons: items }, null, 2)], {
          type: 'application/json',
        }),
      ),
      a = document.createElement('a')
    a.href = url
    a.download = 'function-wars-arsenal.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 500)
  }
  return (
    <>
      <div className="page-head">
        <div>
          <span className="kicker violet">PERSONAL ARSENAL</span>
          <h1>Weapon Library</h1>
        </div>
        <div className="action-row">
          <button
            className="secondary"
            onClick={() => setShowCloud(!showCloud)}
          >
            Cloud arsenal
          </button>
          <button className="secondary" onClick={() => file.current?.click()}>
            Import JSON
          </button>
          <button className="secondary" disabled={!items.length} onClick={exp}>
            Export JSON
          </button>
        </div>
      </div>
      {showCloud && <Cloud items={items} merge={update} />}
      <input
        type="file"
        accept=".json,application/json"
        hidden
        ref={file}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            if (f.size > 200000) throw Error('Import limit is 200 KB.')
            const incoming = decode(JSON.parse(await f.text())),
              merged = new Map(items.map((s) => [s.id, s]))
            incoming.forEach((s) => merged.set(s.id, s))
            if (apply([...merged.values()]))
              setMessage('Imported ' + incoming.length + ' verified weapons.')
          } catch (err) {
            setMessage((err as Error).message)
          }
        }}
      />
      <div className="feedback" role="status">
        {message ||
          items.length + ' saved weapon' + (items.length === 1 ? '' : 's')}
      </div>
      {!items.length ? (
        <div className="empty panel">
          <Icon name="library" size={48} />
          <h2>Your arsenal is empty</h2>
          <p>
            Save a trajectory in the sandbox to bring it into a duel or mission.
          </p>
        </div>
      ) : (
        <div className="missions">
          {items.map((s) => (
            <article className="mission weapon-card" key={s.id}>
              <WeaponPlot item={s} />
              <span className="kicker">{s.families.join(' / ')}</span>
              <h2>{s.name}</h2>
              <code>{s.source}</code>
              <div className="action-row">
                <button className="primary" onClick={() => load(s)}>
                  Open in lab
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setEditing(s)
                    setName(s.name)
                  }}
                >
                  Edit
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <Modal title="Edit weapon" close={() => setEditing(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (
                name.trim() &&
                apply(
                  items.map((s) =>
                    s.id === editing.id
                      ? {
                          ...s,
                          name: name.trim(),
                          modified: new Date().toISOString(),
                        }
                      : s,
                  ),
                )
              )
                setEditing(null)
            }}
          >
            <label>
              Weapon name
              <input
                required
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="action-row">
              <button className="primary">Save changes</button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (apply(items.filter((s) => s.id !== editing.id)))
                    setEditing(null)
                }}
              >
                Delete weapon
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
