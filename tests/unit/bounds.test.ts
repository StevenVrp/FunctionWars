import { expect, it } from 'vitest'
import { compile } from '../../src/math/weapon'
import { TIERS } from '../../src/math/weapon'
import { match, reduce, arenas } from '../../src/combat/state'
import { resolvePath } from '../../src/combat/collision'
it('caps adjustable controls in the engine', () => {
  expect(() => compile('((a+b+c)+(d+f+g))+((h+j+k)+(l+m+n+p))')).toThrow(
    /12 adjustable/,
  )
  expect(() => compile('a*u', { a: NaN })).toThrow()
})
it('bounds non-finite outputs and AST work before firing', () => {
  for (const s of [
    '2^(u^6)',
    'exp(exp(exp(u)))',
    '(u^3)*(u^4)',
    'u(2)',
    'u!',
    'log(u,10)',
    'a[1]',
    'f(u)=u',
  ])
    expect(() => compile(s)).toThrow()
})
it('limits distinct additive terms', () => {
  const s =
    '((sin(u)+cos(u))+(abs(u)+sqrt(u)))+((exp(0.02*u)+ln(u+1))+(u^2+u^3+u))'
  expect(() => compile(s)).toThrow()
})
it('keeps deterministic tier balance across aliases and mode changes', () => {
  const a = compile('sin(0.2*x^2)+log(x+1)'),
    b = compile('ln(u+1)+sin(0.2*u^2)')
  expect(a.stats).toEqual(TIERS[3])
  expect(a.canonical).toBe(b.canonical)
  expect(a.score).toBe(b.score)
})
it('gives higher HP the decision after turn thirty', () => {
  const s = match('t', ['A', 'B'], arenas.Open)
  const next = reduce(
    { ...s, turn: 30, players: [{ ...s.players[0], hp: 80 }, s.players[1]] },
    { type: 'TIMER_EXPIRED' },
  )
  expect(next.outcome).toBe('B wins')
})
it('replaying an in-flight duel after serialization yields identical HP and hit', () => {
  const s = reduce(match('t'), { type: 'FIRE', actor: 0 })
  expect(
    reduce(JSON.parse(JSON.stringify(s)), { type: 'RESOLVE_SHOT' }),
  ).toEqual(reduce(s, { type: 'RESOLVE_SHOT' }))
})
it('detects an arbitrarily thin wall between visual samples of a curved leftward shot', () => {
  const w = compile('0.1*u^2'),
    p = { x: 22, y: 1 },
    b = { x: 18.00047, y: 2.55, w: 0.000001, h: 0.1 }
  const h = resolvePath(w, p, -1, [], [b])
  expect(h.kind).toBe('obstacle')
  expect(h.point.x).toBeGreaterThan(b.x)
  expect(resolvePath(w, p, -1, [], [b])).toEqual(h)
})
