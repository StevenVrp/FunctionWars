import {
  bind,
  parse,
  evaluate,
  format,
  fail,
  limits,
  type Expr,
  type Parameters,
} from './ast.ts'
import { normalize, polynomial, flatten } from './normalize.ts'
import { certify } from './interval.ts'
export const TIERS = [
  { name: 'Basic', roman: 'I', damage: 14, cost: 2, cooldown: 0 },
  { name: 'Developed', roman: 'II', damage: 24, cost: 3, cooldown: 1 },
  { name: 'Advanced', roman: 'III', damage: 34, cost: 4, cooldown: 1 },
  { name: 'Ultimate', roman: 'IV', damage: 48, cost: 6, cooldown: 2 },
] as const
const bases: Record<string, number> = {
  Linear: 1,
  Quadratic: 3,
  Polynomial: 5,
  Absolute: 4,
  Radical: 4,
  Trig: 6,
  Exponential: 6,
  Logarithmic: 6,
  Rational: 6,
}
function structure(a: Expr): { families: string[]; nested: boolean } {
  const p = polynomial(a)
  if (p)
    return {
      families: [
        p.length <= 2 ? 'Linear' : p.length === 3 ? 'Quadratic' : 'Polynomial',
      ],
      nested: false,
    }
  const [b, c] = a.args
  const kind =
    (
      {
        abs: 'Absolute',
        sqrt: 'Radical',
        sin: 'Trig',
        cos: 'Trig',
        tan: 'Trig',
        exp: 'Exponential',
        ln: 'Logarithmic',
        log10: 'Logarithmic',
      } as Record<string, string>
    )[a.op] ??
    (a.op === '/'
      ? 'Rational'
      : a.op === '^'
        ? c.op === 'num'
          ? Number.isInteger(c.value) && c.value! > 0
            ? ''
            : 'Rational'
          : 'Exponential'
        : '')
  if (kind) {
    const arg = a.op === '^' && c.op !== 'num' ? c : a.op === '/' ? c : b
    const inner = polynomial(arg)
    return { families: [kind], nested: !inner || inner.length > 2 }
  }
  const parts = a.args.filter((t) => t.op !== 'num').map(structure)
  return {
    families: [...new Set(parts.flatMap((t) => t.families))],
    nested: parts.some((p) => p.nested),
  }
}
export function compile(
  source: string,
  parameters: Parameters = {},
  domain = 24,
) {
  if (!Number.isFinite(domain) || domain <= 0 || domain > 24)
    fail('Travel interval must lie within 24 units.')
  const tree = parse(source),
    { bound, controls } = bind(tree, parameters)
  certify(bound, domain) // Always validate original domain before eliminating zero or cancelling factors.
  const ast = normalize(bound)
  const check = (n: Expr) => {
    polynomial(n)
    if (
      flatten(n).filter((t) => t.a.op !== 'num' || t.a.value !== 0).length >
      limits.terms
    )
      fail('Limit: 8 active additive terms.')
    n.args.forEach(check)
  }
  check(ast)
  const families = new Set<string>()
  let nested = false
  function active(a: Expr) {
    const y0 = evaluate(a, 0)
    for (let i = 1; i <= 128; i++)
      if (Math.abs(evaluate(a, (i * domain) / 128) - y0) >= 0.25) return true
    return false
  }
  const terms = flatten(ast)
  // Collapse all polynomial terms together so algebraically cancelled powers cannot earn bonuses.
  const poly: number[] = []
  for (const t of terms) {
    const p = polynomial(t.a)
    if (p) {
      p.forEach((v, i) => (poly[i] = (poly[i] ?? 0) + t.k * v))
      continue
    }
    if (active(t.a)) {
      const s = structure(t.a)
      s.families.forEach((f) => families.add(f))
      nested ||= s.nested
    }
  }
  let degree = poly.length - 1
  while (degree > 0 && Math.abs((poly[degree] ?? 0) * domain ** degree) < 0.25)
    degree--
  if (degree > 0)
    families.add(
      degree === 1 ? 'Linear' : degree === 2 ? 'Quadratic' : 'Polynomial',
    )
  if (!families.size) families.add('Linear')
  // Downgrade curves indistinguishable from an affine shot on the activity grid.
  // This deliberately under-awards uncertain structures in competitive play.
  const y0 = evaluate(ast, 0),
    slope = (evaluate(ast, domain) - y0) / domain
  let affine = true
  for (let i = 1; i < 128 && affine; i++) {
    const u = (domain * i) / 128
    affine = Math.abs(evaluate(ast, u) - y0 - slope * u) < 0.25
  }
  if (affine) {
    families.clear()
    families.add('Linear')
    nested = false
  }
  const names = [...families].sort()
  const score = Math.min(
    12,
    Math.max(...names.map((f) => bases[f])) +
      Math.min(4, (names.length - 1) * 2) +
      (nested ? 3 : 0),
  )
  const tier = score <= 2 ? 0 : score <= 5 ? 1 : score <= 8 ? 2 : 3
  return {
    source,
    parameters: { ...parameters },
    tree,
    bound,
    ast,
    controls,
    families: names,
    nested,
    score,
    tier,
    stats: TIERS[tier],
    canonical: format(ast),
    offset: evaluate(ast, 0),
  }
}
export type Weapon = ReturnType<typeof compile>
export interface Point {
  x: number
  y: number
}
export function trajectory(
  w: Weapon,
  start: Point,
  dir: number,
  u: number,
): Point {
  return { x: start.x + dir * u, y: start.y + evaluate(w.ast, u) - w.offset }
}
