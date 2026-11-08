import { describe, it, expect } from 'vitest'
import { compile, trajectory } from '../../src/math/weapon'
import { evaluate, printSource } from '../../src/math/ast'
describe('approved mathematics', () => {
  it.each([
    ['2*u+1', 5],
    ['u^2', 4],
    ['u^3', 8],
    ['u^6', 64],
    ['abs(u-3)', 1],
    ['2*sqrt(u+2)', 4],
    ['(u^2+1)/(u+2)', 1.25],
    ['sin(pi*u/4)', 1],
    ['cos(pi*u)', 1],
    ['tan(0.02*u)', Math.tan(0.04)],
    ['exp(0.1*u)', Math.exp(0.2)],
    ['2^(0.1*u)', 2 ** 0.2],
    ['ln(u+1)', Math.log(3)],
    ['log(e)', 1],
    ['log10(100)', 2],
    ['sqrt(abs(u-4)+1)', Math.sqrt(3)],
    ['sin(0.2*u^2)+ln(u+1)', Math.sin(0.8) + Math.log(3)],
  ])('%s', (s, y) =>
    expect(evaluate(compile(String(s)).ast, 2)).toBeCloseTo(Number(y)),
  )
  it.each([
    ['u+0+0', 1],
    ['sin(u)^2+cos(u)^2+u^2', 3],
    ['2*sin(u)+0.1*u^2', 8],
    ['sin(0.2*u^2)+ln(u+1)', 11],
    ['u+0.00001*sin(u)', 1],
    ['sin(u)-sin(u)+u', 1],
    ['(u+1)^2-u^2', 1],
    ['u+0*exp(u)', 1],
    ['u*(1+0.00001*sin(u))', 1],
    ['u/(1+0.00001*sin(u))', 1],
  ])('score %s', (s, n) => expect(compile(String(s)).score).toBe(n))
  it.each([
    '1/(u-5)',
    '0/(u-5)',
    '1/(u-5.12345)^2',
    'sqrt(u-2)',
    'tan(u)',
    'exp(1000*u)',
    'u^7',
    'foo(u)',
    'a=4',
    '[3]',
    'u.constructor',
    '(u+',
    'sin(400*u)',
    '((((((((((u))))))))))',
    'u+'.repeat(90) + 'u',
  ])('reject %s', (s) => expect(() => compile(s)).toThrow())
  it('anchors mirrored trajectories', () => {
    const w = compile('2*x+5')
    expect(trajectory(w, { x: 22, y: 1 }, -1, 0)).toEqual({ x: 22, y: 1 })
    expect(trajectory(w, { x: 2, y: 1 }, 1, 2)).toEqual({ x: 4, y: 5 })
  })
  it('binds named parameters and edits a single numeric AST node', () => {
    const w = compile('a*sin(0.5*u)', { a: 2 })
    expect(w.controls).toHaveLength(2)
    expect(printSource(w.tree, { id: w.controls[1].start!, value: 0.2 })).toBe(
      'a*sin(0.2*u)',
    )
    expect(() => compile('a*u', { a: 25 })).toThrow()
  })
})
