import { expect, it } from 'vitest'
import { compile } from '../../src/math/weapon'
import { resolvePath, damage } from '../../src/combat/collision'
const origin = { x: 2, y: 1 }
it.each([
  [1, 21],
  [1.25, 21],
  [1.35, 14],
  [1.5, 7],
  [1.67, 7],
])('precision y=%s', (y, d) => {
  const h = resolvePath(compile('0'), origin, 1, [{ x: 12, y }], [])
  expect(h.kind).toBe('target')
  expect(damage(14, h.distance!)).toBe(d)
  expect(h.u).toBeLessThanOrEqual(10)
})
it('near tangent miss', () =>
  expect(
    resolvePath(compile('0'), origin, 1, [{ x: 12, y: 1.6701 }], []).kind,
  ).toBe('boundary'))
it('thin obstruction before target in both directions', () => {
  for (const dir of [1, -1]) {
    const p = { x: dir === 1 ? 2 : 22, y: 1 }
    const h = resolvePath(
      compile('0'),
      p,
      dir,
      [{ x: dir === 1 ? 22 : 2, y: 1 }],
      [{ x: 11.999, y: 0, w: 0.00001, h: 2 }],
    )
    expect(h.kind).toBe('obstacle')
  }
})
it('sweeps rounded corners, high-curvature and oscillating trajectories', () => {
  expect(
    resolvePath(
      compile('6*sin(7*u)'),
      origin,
      1,
      [{ x: 2 + Math.PI / 14, y: 7 }],
      [],
    ).kind,
  ).toBe('target')
  expect(resolvePath(compile('20*u^2'), origin, 1, [], []).kind).toBe(
    'boundary',
  )
  expect(resolvePath(compile('-u'), origin, 1, [], []).kind).toBe('ground')
})
