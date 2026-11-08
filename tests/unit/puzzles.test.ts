import { it, expect } from 'vitest'
import { compile } from '../../src/math/weapon'
import { puzzles, puzzleShot, stars } from '../../src/data/puzzles'
it.each(puzzles)('verifies mission $id: $name', (p) => {
  const result = puzzleShot(p, compile(p.solution))
  expect(result.success).toBe(true)
  expect(stars(p, 1, result.hit)).toBe(3)
  expect(stars(p, p.par + 1, result.hit)).toBe(1)
})
it('enforces family, gate and precision challenges', () => {
  expect(() => puzzleShot(puzzles[0], compile('u^2'))).toThrow()
  expect(puzzleShot(puzzles[7], compile('sin(pi*u/6)')).success).toBe(false)
  expect(
    stars(puzzles[0], 1, {
      kind: 'target',
      u: 4,
      point: { x: 1, y: 1 },
      distance: 0.4,
    }),
  ).toBe(2)
})
