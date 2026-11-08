import { it, expect } from 'vitest'
import {
  match,
  reduce,
  cooldown,
  arenas,
  type Command,
} from '../../src/combat/state'
const fresh = () => match('fixed', ['A', 'B'], arenas.Open)
const basic = [
  { type: 'UPDATE_EXPRESSION', source: '0', parameters: {}, actor: 0 },
  { type: 'FIRE', actor: 0 },
  { type: 'RESOLVE_SHOT' },
] as Command[]
it('spends energy and supports several attacks per turn', () => {
  let s = basic.reduce(reduce, fresh())
  expect(s.players[0].energy).toBe(4)
  expect(s.players[1].hp).toBe(79)
  s = reduce(reduce(s, { type: 'FIRE', actor: 0 }), { type: 'RESOLVE_SHOT' })
  expect(s.players[1].hp).toBe(58)
  expect(() => reduce(s, { type: 'FIRE', actor: 1 })).toThrow()
})
it('tier cooldown across equivalent edits and personal turns', () => {
  let s = fresh()
  s = reduce(s, { type: 'FIRE', actor: 0 })
  expect(() => reduce(s, { type: 'FIRE', actor: 0 })).toThrow()
  s = reduce(s, { type: 'RESOLVE_SHOT' })
  s = reduce(s, {
    type: 'UPDATE_EXPRESSION',
    actor: 0,
    source: '0.0625*u*(20-u)+0',
    parameters: {},
  })
  expect(() => reduce(s, { type: 'FIRE', actor: 0 })).toThrow(/cooling/)
  for (let i = 0; i < 2; i++)
    s = reduce(s, { type: 'END_TURN', actor: s.current })
  expect(cooldown(s.players[0], 1)).toBe(1)
  for (let i = 0; i < 2; i++)
    s = reduce(s, { type: 'END_TURN', actor: s.current })
  expect(cooldown(s.players[0], 1)).toBe(0)
})
it('Tier IV skips two personal turns', () => {
  let s = reduce(fresh(), {
    type: 'SELECT_FUNCTION',
    source: 'sin(0.2*u^2)+ln(u+1)',
    parameters: {},
    actor: 0,
  })
  s = reduce(reduce(s, { type: 'FIRE', actor: 0 }), { type: 'RESOLVE_SHOT' })
  for (const expected of [2, 1, 0]) {
    s = reduce(s, { type: 'END_TURN', actor: 1 })
    expect(cooldown(s.players[0], 3)).toBe(expected)
    s = reduce(s, { type: 'END_TURN', actor: 0 })
  }
})
it('reposition path, budget and boundaries', () => {
  const s = fresh(),
    m = reduce(s, { type: 'MOVE_PLAYER', actor: 0, delta: 2 })
  expect(m.players[0].x).toBe(4)
  expect(m.players[0].energy).toBe(4)
  expect(() => reduce(m, { type: 'MOVE_PLAYER', actor: 0, delta: 1 })).toThrow()
  expect(() =>
    reduce(s, { type: 'MOVE_PLAYER', actor: 0, delta: -2 }),
  ).toThrow()
  expect(() =>
    reduce(
      { ...s, obstacles: [{ x: 3, y: 0, w: 0.1, h: 2 }] },
      { type: 'MOVE_PLAYER', actor: 0, delta: 2 },
    ),
  ).toThrow()
})
it('timer, draw, victory, reset and deterministic replay', () => {
  let s = fresh()
  expect(s.players[0].hp).toBe(100)
  expect(reduce(s, { type: 'TIMER_EXPIRED' }).current).toBe(1)
  expect(reduce(s, { type: 'TICK', seconds: 60 }).turn).toBe(2)
  for (let i = 0; i < 30; i++)
    s = reduce(s, { type: 'END_TURN', actor: s.current })
  expect(s.outcome).toBe('Draw')
  expect(reduce(s, { type: 'RESTART_MATCH' })).toEqual(fresh())
  s = fresh()
  s.players[1].hp = 10
  expect(basic.reduce(reduce, s).outcome).toBe('A wins')
  expect(basic.reduce(reduce, fresh())).toEqual(basic.reduce(reduce, fresh()))
})
it('rejects insufficient energy and pauses clock in flight', () => {
  let s = fresh()
  s.players[0].energy = 2
  expect(() => reduce(s, { type: 'FIRE', actor: 0 })).toThrow(/energy/)
  s = reduce(fresh(), { type: 'FIRE', actor: 0 })
  expect(() => reduce(s, { type: 'TICK', seconds: 5 })).toThrow()
})
