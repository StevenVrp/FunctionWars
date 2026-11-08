import { it, expect } from 'vitest'
import {
  startLive,
  act,
  advance,
  defaultSetup,
  powers,
} from '../../src/combat/live'
import { compile } from '../../src/math/weapon'
const fresh = () => startLive({ ...defaultSetup, map: 5 }, ['A', 'B'], 0)
const fire = (source = '0') => ({
  type: 'fire' as const,
  source,
  parameters: {},
})
it('lets both seats fire before either lands; elapsed time clocks survive serialized replay', () => {
  let s = act(fresh(), 0, fire(), 0)
  s = act(s, 1, fire(), 0)
  expect(s.flights).toHaveLength(2)
  const next = advance(s, 3000)
  expect(next.players.map((p) => p.hp)).toEqual([79, 79])
  expect(next).toEqual(advance(JSON.parse(JSON.stringify(s)), 3000))
})
it('gives same-time lethal hits a draw', () => {
  const s = fresh()
  s.players.forEach((p) => (p.hp = 10))
  expect(advance(act(act(s, 0, fire(), 0), 1, fire(), 0), 3000).result).toBe(
    'Draw',
  )
})
it('banks unused energy for exactly one refill', () => {
  const s = act(fresh(), 0, { type: 'power', id: 'bank' }, 0)
  expect(advance(s, 10000).players[0].energy).toBe(18)
  expect(advance(s, 20000).players[0].energy).toBe(10)
})
it('fires one accurate tier I sentry attack on the next refill and honors wards', () => {
  let s = act(fresh(), 1, { type: 'power', id: 'shield0' }, 0)
  s = act(s, 0, { type: 'power', id: 'auto' }, 10)
  const n = advance(s, 20000)
  expect(n.players[1].hp).toBe(100)
  expect(n.players[1].shield).toBeNull()
  expect(n.players[0].auto).toBe(false)
  expect(
    advance(act(fresh(), 0, { type: 'power', id: 'auto' }, 1), 11000).players[1]
      .hp,
  ).toBe(79)
})
it('enforces bans on tiers and normalized presets regardless of input method', () => {
  let s = fresh()
  s.setup.blocked = [compile('u').canonical]
  expect(() => act(s, 0, fire('u+0'), 0)).toThrow(/forbidden/)
  s.setup.bans = [0]
  expect(() => act(s, 0, fire(), 0)).toThrow()
  expect(() => act(s, 1, { type: 'power', id: 'auto' }, 0)).toThrow()
})
it('tier IV destroys its struck obstacle, lower tiers leave it in place', () => {
  let s = fresh()
  s.boxes = [{ x: 5, y: 0, w: 1, h: 10, id: 7 }]
  const expr = 'sin(0.2*u^2)+ln(u+1)'
  expect(compile(expr).tier).toBe(3)
  expect(advance(act(s, 0, fire(expr), 0), 3000).boxes).toHaveLength(0)
  expect(advance(act(s, 0, fire(), 0), 3000).boxes).toHaveLength(1)
})
it('uses physical hills for collision and changes launch height on movement', () => {
  let s = startLive({ ...defaultSetup, map: 3 }, ['A', 'B'], 0)
  expect(act(s, 0, fire(), 0).flights[0].hit.kind).toBe('ground')
  const moved = act(s, 0, { type: 'move', dx: 1 }, 0)
  expect(moved.players[0].y).not.toBe(s.players[0].y)
})
it('charges every power and records an effect; insufficient energy is rejected', () => {
  for (const p of powers) {
    const s = act(fresh(), 0, { type: 'power', id: p.id }, 0)
    expect(s.players[0].energy).toBe(10 - p.cost)
    expect(s.events.at(-1)?.kind).toBe(p.id)
    s.players[0].energy = 0
    expect(() => act(s, 0, { type: 'power', id: p.id }, 100)).toThrow()
  }
})
it('limits match duration and protects cooldowns', () => {
  const s = act(fresh(), 0, fire('0.05*u*(20-u)'), 0)
  expect(() => act(advance(s, 3000), 0, fire('0.05*u*(20-u)'), 3001)).toThrow()
  expect(advance(fresh(), 300000).result).toBe('Draw')
})
it('allows a new barrier to intercept a projectile already in flight', () => {
  let s = act(fresh(), 0, fire(), 0)
  expect(s.flights[0].hit.kind).toBe('target')
  s = act(s, 1, { type: 'power', id: 'wall' }, 300)
  expect(s.flights[0].hit.kind).toBe('obstacle')
  expect(advance(s, 3000).players[1].hp).toBe(100)
})
it('chassis changes actual precision damage and tier cooldown', () => {
  const s = startLive(
    { ...defaultSetup, map: 5, tanks: ['vector', 'bastion'] },
    ['A', 'B'],
    0,
  )
  const both = act(act(s, 0, fire(), 0), 1, fire(), 0)
  expect(both.players.map((p) => p.ready[0])).toEqual([350, 650])
  expect(advance(both, 3000).players.map((p) => p.hp)).toEqual([74, 82])
})
it('enforces tank-only equipment on the server engine', () => {
  const s = startLive(
    { ...defaultSetup, map: 5, tanks: ['bastion', 'warden'] },
    ['A', 'B'],
    0,
  )
  s.boxes = [{ x: 5, y: 0, w: 1, h: 2, id: 8 }]
  s.players[1].hp = 85
  expect(() => act(s, 1, { type: 'power', id: 'breach' }, 0)).toThrow()
  expect(act(s, 1, { type: 'power', id: 'repair' }, 0).players[1].hp).toBe(100)
  const armed = act(s, 0, { type: 'power', id: 'breach' }, 0)
  const fired = act(armed, 0, fire(), 0)
  expect(fired.players[0].breach).toBe(false)
  expect(advance(fired, 3000).boxes).toHaveLength(0)
})
it('rejects unknown chassis and reads older matches with neutral balance', () => {
  expect(() =>
    startLive(
      { ...defaultSetup, tanks: ['fake', 'warden'] as never },
      ['A', 'B'],
      0,
    ),
  ).toThrow()
  const s = fresh()
  delete s.players[0].tank
  expect(advance(act(s, 0, fire(), 0), 3000).players[1].hp).toBe(79)
})
