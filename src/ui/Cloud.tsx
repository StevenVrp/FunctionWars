import { useEffect, useState } from 'react'
import { cloud, gameUrl } from '../online/client'
import { decode, type Saved } from '../data/storage'
export function Cloud({
  items,
  merge,
  onAccount,
}: {
  items?: Saved[]
  merge?: (s: Saved[]) => void
  onAccount?: (id: string) => void
}) {
  const [uid, setUid] = useState(''),
    [email, emailSet] = useState(''),
    [pass, passSet] = useState(''),
    [name, setName] = useState(''),
    [msg, setMsg] = useState(()=>sessionStorage.getItem('fw-confirmation')??''),
    [busy, setBusy] = useState(false),
    [rank, setRank] = useState<
      { name: string; rank: number; points: number }[] | null
    >(null)
  useEffect(() => {
    sessionStorage.removeItem('fw-confirmation')
    const { data } = cloud().auth.onAuthStateChange((_e, s) =>
      setUid(s?.user.id ?? ''),
    )
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    let live = true
    onAccount?.(uid)
    setRank(null)
    setName('')
    if (uid)
      cloud()
        .from('fw_profiles')
        .select('name')
        .eq('id', uid)
        .maybeSingle()
        .then(({ data, error }) => {
          if (live) {
            if (error) setMsg(error.message)
            else if (data) {
              setName(data.name)
            } else setMsg('Choose a pilot name and save your profile.')
          }
        })
    return () => {
      live = false
    }
  }, [uid, onAccount])
  async function run(fn: () => Promise<string>) {
    setMsg('')
    setBusy(true)
    try {
      setMsg(await fn())
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function auth(signup: boolean) {
    await run(async () => {
      const c = cloud().auth,
        { error } = signup
          ? await c.signUp({ email, password: pass, options: {emailRedirectTo:gameUrl} })
          : await c.signInWithPassword({ email, password: pass })
      if (error) throw error
      passSet('')
      return signup
        ? 'Account request sent. Check your email if confirmation is enabled.'
        : 'Signed in.'
    })
  }
  return (
    <section className="cloud-panel panel">
      <h2>Pilot account</h2>
      <fieldset disabled={busy}>
        {!uid ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void auth(false)
            }}
          >
            <label>
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => emailSet(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                value={pass}
                onChange={(e) => passSet(e.target.value)}
              />
            </label>
            <div className="action-row">
              <button className="primary">Sign in</button>
              <button
                className="secondary"
                type="button"
                onClick={() => auth(true)}
              >
                Create account
              </button>
            </div>
          </form>
        ) : (
          <>
            <label>
              Pilot name
              <input
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="action-row">
              <button
                className="primary"
                onClick={() =>
                  run(async () => {
                    if (!name.trim()) throw Error('Enter a pilot name.')
                    const { data, error } = await cloud()
                      .from('fw_profiles')
                      .select('id')
                      .eq('id', uid)
                      .maybeSingle()
                    if (error) throw error
                    const payload = { name: name.trim() }
                    const op = data
                      ? cloud()
                          .from('fw_profiles')
                          .update(payload)
                          .eq('id', uid)
                      : cloud()
                          .from('fw_profiles')
                          .insert({ ...payload, id: uid })
                    const r = await op
                    if (r.error) throw r.error
                    return 'Pilot profile saved.'
                  })
                }
              >
                Save profile
              </button>
              <button
                className="secondary"
                onClick={() =>
                  run(async () => {
                    const { data, error } = await cloud()
                      .from('fw_ladder')
                      .select('*')
                      .order('rank')
                      .order('name')
                      .limit(50)
                    if (error) throw error
                    setRank(data)
                    return data.length
                      ? 'World ranking · top 50'
                      : 'No completed ranked matches yet.'
                  })
                }
              >
                World ranking
              </button>
              {items && merge && (
                <>
                  <button
                    className="secondary"
                    onClick={() =>
                      run(async () => {
                        const { error } = await cloud()
                          .from('fw_arsenals')
                          .upsert({
                            owner: uid,
                            weapons: items,
                            updated_at: new Date().toISOString(),
                          })
                        if (error) throw error
                        return 'Cloud arsenal replaced with your local weapons.'
                      })
                    }
                  >
                    Back up arsenal
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      run(async () => {
                        const { data, error } = await cloud()
                          .from('fw_arsenals')
                          .select('weapons')
                          .eq('owner', uid)
                          .maybeSingle()
                        if (error) throw error
                        if (!data) return 'No cloud backup yet.'
                        const incoming = decode({
                            version: 1,
                            weapons: data.weapons,
                          }),
                          all = new Map(items.map((s) => [s.id, s]))
                        for (const s of incoming) {
                          const old = all.get(s.id)
                          if (
                            !old ||
                            Date.parse(s.modified) > Date.parse(old.modified)
                          )
                            all.set(s.id, s)
                        }
                        merge([...all.values()])
                        return 'Cloud arsenal merged.'
                      })
                    }
                  >
                    Restore arsenal
                  </button>
                </>
              )}
              <button
                className="secondary"
                onClick={() =>
                  run(async () => {
                    const { error } = await cloud().auth.signOut()
                    if (error) throw error
                    return 'Signed out.'
                  })
                }
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </fieldset>
      <p role="status">{msg}</p>
      {rank && rank.length > 0 && (
        <ol>
          {rank.map((r, i) => (
            <li key={i}>
              #{r.rank} {r.name} · {r.points} pts
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
