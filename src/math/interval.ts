import { calculate, evaluate, fail, limits, type Expr } from './ast.ts'
export type Range = [number, number]
function phase(lo: number, hi: number, point: number, period: number) {
  return (
    Math.ceil((lo - point) / period - 1e-14) <=
    Math.floor((hi - point) / period + 1e-14)
  )
}
export function range(a: Expr, lo: number, hi: number): Range {
  if (a.op === 'num') return [a.value!, a.value!]
  if (a.op === 'u') return [lo, hi]
  const [l, h] = range(a.args[0], lo, hi),
    [p, q] = a.args[1] ? range(a.args[1], lo, hi) : [0, 0]
  switch (a.op) {
    case '+':
      return [l + p, h + q]
    case '-':
      return [l - q, h - p]
    case 'neg':
      return [-h, -l]
    case '*':
    case '/': {
      if (a.op === '/' && p <= 0 && q >= 0) fail('Denominator may reach zero.')
      const v = [
        calculate(a.op, l, p),
        calculate(a.op, l, q),
        calculate(a.op, h, p),
        calculate(a.op, h, q),
      ]
      return [Math.min(...v), Math.max(...v)]
    }
    case '^': {
      if (p === q && Number.isInteger(p)) {
        if (p < 0 && l <= 0 && h >= 0)
          fail('Negative powers require a nonzero base.')
        const m = l ** p,
          n = h ** p
        return [
          p > 0 && p % 2 === 0 && l <= 0 && h >= 0 ? 0 : Math.min(m, n),
          Math.max(m, n),
        ]
      }
      if (l < 0 || (l === 0 && p <= 0))
        fail('A real-valued power needs a nonnegative base here.')
      const v = [l ** p, l ** q, h ** p, h ** q]
      return [Math.min(...v), Math.max(...v)]
    }
    case 'sqrt':
      if (l < 0) fail('Square root may be undefined.')
      return [Math.sqrt(l), Math.sqrt(h)]
    case 'ln':
    case 'log10':
      if (l <= 0) fail('Logarithm needs a positive argument.')
      return [calculate(a.op, l), calculate(a.op, h)]
    case 'abs':
      return [
        l <= 0 && h >= 0 ? 0 : Math.min(Math.abs(l), Math.abs(h)),
        Math.max(Math.abs(l), Math.abs(h)),
      ]
    case 'exp':
      return [Math.exp(l), Math.exp(h)]
    case 'tan':
      if (phase(l, h, Math.PI / 2, Math.PI))
        fail('Tangent crosses a vertical asymptote.')
      return [Math.tan(l), Math.tan(h)]
    case 'cos':
    case 'sin': {
      const offset = a.op === 'sin' ? Math.PI / 2 : 0
      return [
        phase(l, h, offset + Math.PI, 2 * Math.PI)
          ? -1
          : Math.min(calculate(a.op, l), calculate(a.op, h)),
        phase(l, h, offset, 2 * Math.PI)
          ? 1
          : Math.max(calculate(a.op, l), calculate(a.op, h)),
      ]
    }
    default:
      return fail('Unsupported interval operation.')
  }
}
export function certify(a: Expr, max: number) {
  let budget = limits.intervals
  function walk(l: number, h: number, d: number) {
    if (--budget < 0) fail('Interval validation budget exceeded.')
    try {
      const r = range(a, l, h)
      if (r.some((v) => !Number.isFinite(v) || Math.abs(v) > limits.maxValue))
        fail('Output exceeds the finite range.')
      return
    } catch (err) {
      if (
        d >= 16 ||
        !Number.isFinite(evaluate(a, l)) ||
        !Number.isFinite(evaluate(a, h))
      )
        fail(
          (err as Error).message +
            ' Over u = ' +
            l.toFixed(3) +
            '…' +
            h.toFixed(3) +
            '.',
        )
      const m = (l + h) / 2
      walk(l, m, d + 1)
      walk(m, h, d + 1)
    }
  }
  walk(0, max, 0)
  // Sum interval widths of the phase on a fixed partition. Each encloses its entire subinterval.
  function oscillation(n: Expr) {
    if (['sin', 'cos', 'tan'].includes(n.op)) {
      let span = 0
      for (let i = 0; i < 96; i++) {
        const [l, h] = range(n.args[0], (i * max) / 96, ((i + 1) * max) / 96)
        span += h - l
      }
      if (span > limits.cycles * 2 * Math.PI)
        fail('Oscillation limit exceeded (32 cycles).')
    }
    n.args.forEach(oscillation)
  }
  oscillation(a)
}
