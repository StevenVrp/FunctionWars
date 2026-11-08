import { selectTank } from './engine.js'
// The engine bundle is built from src/combat/live.ts with npm run build:edge.
import { startLive, advance, act } from './engine.js'
const url = Deno.env.get('SUPABASE_URL')!,
  service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
}
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
async function db(table: string, method = 'GET', body?: unknown) {
  const res = await fetch(url + '/rest/v1/' + table, {
    method,
    headers: {
      apikey: service,
      Authorization: 'Bearer ' + service,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const e = await res.json()
    throw Error(
      e.code === '42P01'
        ? 'Install supabase/setup.sql in the SQL Editor.'
        : e.code === '23505'
          ? 'Room code collision. Retry.'
          : 'Database request failed. Check the SQL setup.',
    )
  }
  return await res.json()
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return response({ error: 'POST required' }, 405)
  try {
    const auth = req.headers.get('Authorization') ?? ''
    const user = await fetch(url + '/auth/v1/user', {
      headers: { apikey: service, Authorization: auth },
    })
    if (!user.ok) return response({ error: 'Sign in to play.' }, 401)
    const uid = (await user.json()).id
    const raw = await req.text()
    if (raw.length > 80000) return response({ error: 'Request too large' }, 413)
    const { op, code, setup, action, nonce, tank } = JSON.parse(raw)
    const [profile] = await db('fw_profiles?id=eq.' + uid)
    if (!profile) throw Error('Save your pilot profile first.')
    if (op === 'create') {
      setup.tanks = [selectTank(tank), 'warden']
      startLive(setup, [profile.name, 'Guest'], Date.now())
      const room = {
        code: crypto.randomUUID().replaceAll('-', '').slice(0, 12),
        host: uid,
        setup,
      }
      await db('fw_rooms', 'POST', room)
      return response({
        code: room.code,
        seat: 0,
        state: null,
        now: Date.now(),
        version: 0,
      })
    }
    if (typeof code !== 'string' || !/^[0-9a-f]{12}$/.test(code))
      throw Error('Enter a 12-character room code.')
    for (let i = 0; i < 6; i++) {
      const [r] = await db('fw_rooms?code=eq.' + code)
      if (!r) throw Error('Room not found.')
      const now = Date.now()
      let seat = r.host === uid ? 0 : r.guest === uid ? 1 : -1
      const patch: Record<string, unknown> = {}
      if (op === 'join' && seat === -1 && !r.guest) {
        if (now - Date.parse(r.created_at) > 86400000)
          throw Error('Room has expired.')
        seat = 1
        patch.guest = uid
        const [host] = await db('fw_profiles?id=eq.' + r.host)
        const selected = {
          ...r.setup,
          tanks: [selectTank(r.setup.tanks?.[0]), selectTank(tank)],
        }
        patch.setup = selected
        const state = startLive(selected, [host.name, profile.name], now)
        patch.state = state
      }
      if (seat < 0) throw Error('This room is full or private.')
      if (op === 'cancel' && !r.guest && seat === 0) {
        const deleted = await db(
          'fw_rooms?code=eq.' + code + '&version=eq.' + r.version,
          'DELETE',
        )
        if (!deleted.length) continue
        return response({ cancelled: true })
      }
      if (r.state) {
        let next = advance(r.state, now)
        if (op === 'act' && !next.result && r.last_ids[seat] !== nonce) {
          if (typeof nonce !== 'string' || nonce.length > 64 || !nonce.length)
            throw Error('Missing command ID.')
          if (
            !action ||
            !['fire', 'move', 'power', 'forfeit'].includes(action.type)
          )
            throw Error('Invalid command.')
          if (
            action.type === 'fire' &&
            (typeof action.source !== 'string' ||
              action.source.length > 450 ||
              !action.parameters ||
              typeof action.parameters !== 'object' ||
              Object.values(action.parameters).some(
                (v) => typeof v !== 'number' || !Number.isFinite(v),
              ))
          )
            throw Error('Invalid equation.')
          next = act(next, seat, action, now)
          patch.last_ids = { ...r.last_ids, [seat]: nonce }
        }
        if (next !== r.state) {
          patch.state = next
          patch.ended = !!next.result
        }
      }
      if (Object.keys(patch).length) {
        patch.version = r.version + 1
        const changed = await db(
          'fw_rooms?code=eq.' + code + '&version=eq.' + r.version,
          'PATCH',
          patch,
        )
        if (!changed.length) continue
        Object.assign(r, patch)
      }
      return response({
        code,
        seat,
        state: r.state,
        setup: r.setup,
        version: r.version,
        now,
      })
    }
    return response({ error: 'Room busy. Retry.' }, 409)
  } catch (e) {
    return response(
      { error: e instanceof Error ? e.message : 'Request failed' },
      400,
    )
  }
})
