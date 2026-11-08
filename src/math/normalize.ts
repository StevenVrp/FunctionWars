import { node, num, calculate, format, fail, limits, type Expr } from './ast.ts'
export function polynomial(a: Expr): number[] | undefined {
  if (a.op === 'num') return [a.value!]
  if (a.op === 'u') return [0, 1]
  const p = polynomial(a.args[0]),
    q = a.args[1] ? polynomial(a.args[1]) : undefined
  if (!p) return
  const trim = (r: number[]) => {
    while (r.length > 1 && r.at(-1) === 0) r.pop()
    if (r.length - 1 > limits.degree) fail('Polynomial degree exceeds 6.')
    return r
  }
  const mul = (x: number[], y: number[]) => {
    const z = Array(x.length + y.length - 1).fill(0) as number[]
    x.forEach((v, i) => y.forEach((w, j) => (z[i + j] += v * w)))
    return trim(z)
  }
  if (a.op === 'neg') return p.map((v) => -v)
  if (!q) return
  if (a.op === '+' || a.op === '-')
    return trim(
      Array.from(
        { length: Math.max(p.length, q.length) },
        (_, i) => (p[i] ?? 0) + (a.op === '+' ? 1 : -1) * (q[i] ?? 0),
      ),
    )
  if (a.op === '*') return mul(p, q)
  if (a.op === '/' && q.length === 1) return p.map((v) => v / q[0])
  if (a.op === '^' && q.length === 1 && Number.isInteger(q[0]) && q[0] >= 0) {
    if (p.length > 1 && q[0] * (p.length - 1) > 6)
      fail('Polynomial degree exceeds 6.')
    if (p.length === 1) return [p[0] ** q[0]]
    let r = [1]
    for (let i = 0; i < q[0]; i++) r = mul(r, p)
    return r
  }
}
export function flatten(a: Expr, sign = 1, out: { a: Expr; k: number }[] = []) {
  if (a.op === '+' || a.op === '-') {
    flatten(a.args[0], sign, out)
    flatten(a.args[1], a.op === '-' ? -sign : sign, out)
  } else if (a.op === 'neg') flatten(a.args[0], -sign, out)
  else out.push({ a, k: sign })
  return out
}
function product(a: Expr, b: Expr): Expr {
  if ((a.op === 'num' && a.value === 0) || (b.op === 'num' && b.value === 0))
    return num(0)
  if (a.op === 'num' && a.value === 1) return b
  if (b.op === 'num' && b.value === 1) return a
  if (a.op === 'num' && b.op === 'num') return num(a.value! * b.value!)
  if (b.op === 'num') return product(b, a)
  if (a.op === 'num' && b.op === '*' && b.args[0].op === 'num')
    return product(num(a.value! * b.args[0].value!), b.args[1])
  if (a.op !== 'num' && format(a) > format(b)) return node('*', b, a)
  return node('*', a, b)
}
function sum(a: Expr): Expr {
  const terms = new Map<string, { a: Expr; k: number }>()
  let c = 0
  for (const t of flatten(a)) {
    let b = t.a,
      k = t.k
    if (b.op === '*' && b.args[0].op === 'num') {
      k *= b.args[0].value!
      b = b.args[1]
    }
    if (b.op === 'num') {
      c += k * b.value!
      continue
    }
    const key = format(b)
    terms.set(key, { a: b, k: k + (terms.get(key)?.k ?? 0) })
  }
  for (const t of terms.values()) {
    const [fn, ex] = t.a.args
    if (t.a.op !== '^' || ex?.value !== 2 || fn.op !== 'sin') continue
    const partner = terms.get(
      format(node('^', node('cos', fn.args[0]), num(2))),
    )
    if (partner && partner.k === t.k) {
      c += t.k
      partner.k = 0
      t.k = 0
    }
  }
  const parts = [...terms.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map((e) => e[1])
    .filter((t) => t.k !== 0)
    .map((t) => product(num(t.k), t.a))
  if (c !== 0 || !parts.length) parts.push(num(c))
  return parts.reduce((x, y) => node('+', x, y))
}
export function normalize(a: Expr): Expr {
  if (!a.args.length) return a
  const args = a.args.map(normalize),
    [b, c] = args
  if (args.every((x) => x.op === 'num'))
    return num(calculate(a.op, b.value!, c?.value))
  if (a.op === '*') return product(b, c)
  if (a.op === '+' || a.op === '-' || a.op === 'neg')
    return sum(node(a.op, ...args))
  if (a.op === '^' && c.value === 0) return num(1)
  if ((a.op === '^' || a.op === '/') && c.value === 1) return b
  if (a.op === '/' && format(b) === format(c)) return num(1)
  return node(a.op, ...args)
}
