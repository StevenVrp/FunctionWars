// Run the shipped SQL on PostgreSQL WASM and the actual Edge handler against
// a small PostgREST/Auth transport fixture. No live project credentials needed.
import { PGlite } from '@electric-sql/pglite'
import { build } from 'esbuild'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const pg = new PGlite(),
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'fw-edge-'))
const [a, b, c] = Array.from({ length: 3 }, () => crypto.randomUUID())
let handler
try {
  await pg.exec(
    "create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create role service_role bypassrls;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('fw.test_uid',true),'')::uuid$$; grant usage on schema auth to authenticated;",
  )
  const sql = await fs.readFile('supabase/setup.sql', 'utf8')
  await pg.exec(sql)
  await pg.exec(sql)
  for (const [i, id] of [a, b, c].entries()) {
    await pg.query('insert into auth.users values ($1)', [id])
    await pg.query('insert into fw_profiles(id,name) values($1,$2)', [
      id,
      'Pilot ' + i,
    ])
  }
  await pg.exec('set role authenticated')
  await pg.query("select set_config('fw.test_uid',$1,false)", [a])
  await pg.query('insert into fw_arsenals(owner,weapons) values($1,$2)', [
    a,
    '[]',
  ])
  await assert.rejects(
    pg.query('update fw_profiles set wins=900 where id=$1', [a]),
  )
  await assert.rejects(pg.query('select * from fw_rooms'))
  await pg.query("select set_config('fw.test_uid',$1,false)", [b])
  assert.equal((await pg.query('select * from fw_arsenals')).rows.length, 0)
  assert.equal(
    (
      await pg.query(
        'update fw_profiles set name=$1 where id=$2 returning id',
        ['Hijack', a],
      )
    ).rows.length,
    0,
  )
  await pg.exec('reset role')
  globalThis.Deno = {
    env: { get: () => 'https://fixture.local' },
    serve(fn) {
      handler = fn
    },
  }
  globalThis.fetch = async (input, init = {}) => {
    const u = new URL(input)
    if (u.pathname === '/auth/v1/user') {
      const uid = init.headers.Authorization?.slice(7)
      return Response.json([a, b, c].includes(uid) ? { id: uid } : {}, {
        status: [a, b, c].includes(uid) ? 200 : 401,
      })
    }
    const table = u.pathname.split('/').at(-1)
    assert.ok(['fw_rooms', 'fw_profiles'].includes(table))
    const method = init.method || 'GET',
      payload = init.body ? JSON.parse(init.body) : {},
      params = []
    const bind = (v) => {
      params.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v)
      return '$' + params.length
    }
    const assignments = Object.keys(payload).map(
      (k) => k + '=' + bind(payload[k]),
    )
    const where = [...u.searchParams]
      .map(([k, v]) => k + '=' + bind(v.slice(3)))
      .join(' and ')
    let q = 'select * from ' + table + ' where ' + where
    if (method === 'POST')
      q =
        'insert into ' +
        table +
        '(' +
        Object.keys(payload).join(',') +
        ') values(' +
        params.map((_, i) => '$' + (i + 1)).join(',') +
        ') returning *'
    if (method === 'PATCH')
      q =
        'update ' +
        table +
        ' set ' +
        assignments.join(',') +
        ' where ' +
        where +
        ' returning *'
    if (method === 'DELETE')
      q = 'delete from ' + table + ' where ' + where + ' returning *'
    try {
      return Response.json((await pg.query(q, params)).rows)
    } catch (e) {
      return Response.json({ code: e.code }, { status: 400 })
    }
  }
  const out = path.join(tmp, 'edge.mjs')
  await build({
    entryPoints: ['supabase/functions/fw-duel/index.ts'],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    outfile: out,
  })
  await import(pathToFileURL(out))
  const call = async (uid, body) => {
    const res = await handler(
      new Request('https://fixture.local/functions/v1/fw-duel', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + uid },
        body: JSON.stringify(body),
      }),
    )
    return { status: res.status, ...(await res.json()) }
  }
  assert.equal((await call('invalid', { op: 'read' })).status, 401)
  const setup = { map: 5, pulse: 10, bans: [], blocked: [] },
    room = await call(a, { op: 'create', setup, tank: 'vector' })
  assert.equal(room.status, 200)
  const code = room.code
  const joined = await call(b, { op: 'join', code, tank: 'bastion' })
  assert.equal(joined.seat, 1)
  assert.deepEqual(
    joined.state.players.map((p) => p.tank),
    ['vector', 'bastion'],
  )
  const reconnect = await call(b, { op: 'join', code, tank: 'warden' })
  assert.equal(reconnect.state.players[1].tank, 'bastion')
  assert.equal((await call(c, { op: 'read', code })).status, 400)
  const shot = { type: 'fire', source: '0', parameters: {} },
    send = (u, n) => call(u, { op: 'act', code, action: shot, nonce: n })
  const pair = await Promise.all([send(a, 'a1'), send(b, 'b1')])
  assert.ok(pair.every((r) => r.status === 200))
  const snapshot = await call(a, { op: 'read', code })
  assert.equal(snapshot.state.flights.length, 2)
  const retry = await send(a, 'a1')
  assert.equal(retry.state.players[0].energy, 8)
  const end = await call(b, {
    op: 'act',
    code,
    nonce: 'b2',
    action: { type: 'forfeit' },
  })
  assert.equal(end.state.winner, 0)
  await call(a, { op: 'read', code })
  const ranks = (await pg.query('select * from fw_ladder order by rank')).rows
  assert.equal(ranks[0].wins, 1)
  assert.equal(ranks[1].losses, 1)
  assert.equal(ranks[0].points, 3)
  console.log(
    'PASS: SQL setup and rerun, private arsenals, protected profile and room writes, bearer authentication, two-seat join, outsider rejection, concurrent fire, retry deduplication, finalization and ranking.',
  )
} finally {
  await pg.close()
  await fs.rm(tmp, { recursive: true, force: true })
}
