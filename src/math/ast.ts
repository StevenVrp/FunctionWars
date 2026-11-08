export type Expr = {
  op: string
  args: Expr[]
  value?: number
  name?: string
  start?: number
  end?: number
}
export type Parameters = Record<string, number>
export const num = (value: number): Expr => ({ op: 'num', args: [], value })
export const node = (op: string, ...args: Expr[]): Expr => ({ op, args })
export const funcs = new Set([
  'abs',
  'sqrt',
  'sin',
  'cos',
  'tan',
  'ln',
  'log',
  'log10',
  'exp',
])
export const limits = {
  nodes: 80,
  depth: 8,
  terms: 8,
  parameters: 12,
  degree: 6,
  score: 12,
  cycles: 32,
  intervals: 16000,
  maxValue: 1e12,
}
export function fail(message: string): never {
  throw Error(message)
}
import {
  create,
  parseDependencies,
  type MathNode,
  type ConstantNode,
  type OperatorNode,
  type SymbolNode,
  type FunctionNode,
  type ParenthesisNode,
} from 'mathjs'
const mathParser = create(parseDependencies, {}).parse
export function parse(source: string): Expr {
  if (!source.trim()) fail('Enter a function of u.')
  if (source.length > 450) fail('Expression exceeds 450 characters.')
  if (!/^[0-9a-zA-Z+*/^().\- \t]+$/.test(source))
    fail('Use numbers, u, arithmetic, and approved functions only.')
  let total = 0,
    serial = 0
  function visit(n: MathNode, d: number): Expr {
    if (++total > limits.nodes || d > limits.depth)
      fail('Limit: 80 nodes and 8 levels of nesting.')
    switch (n.type) {
      case 'ConstantNode': {
        const v = (n as ConstantNode).value
        if (typeof v !== 'number' || !Number.isFinite(v))
          fail('Use finite numbers.')
        return { ...num(v), start: serial++ }
      }
      case 'SymbolNode': {
        const s = (n as SymbolNode).name
        if (s === 'u' || s === 'x') return node('u')
        if (s === 'pi' || s === 'e')
          return { ...num(s === 'pi' ? Math.PI : Math.E), name: s }
        if (/^[a-df-hj-np-tvw-z]$/.test(s))
          return { op: 'param', args: [], name: s }
        return fail('Unknown symbol “' + s + '”. Use u for distance.')
      }
      case 'ParenthesisNode':
        return visit((n as ParenthesisNode).content, d + 1)
      case 'OperatorNode': {
        const o = n as OperatorNode
        if (!['+', '-', '*', '/', '^'].includes(o.op) || o.implicit)
          fail('Use explicit +, −, *, / and ^ operators.')
        const args = o.args.map((b) => visit(b, d + 1))
        if (args.length === 1 && o.op === '+') return args[0]
        if (
          args.length === 1 &&
          o.op === '-' &&
          args[0].op === 'num' &&
          args[0].start !== undefined
        )
          return { ...args[0], value: -args[0].value! }
        return node(args.length === 1 ? 'neg' : o.op, ...args)
      }
      case 'FunctionNode': {
        const f = n as FunctionNode
        if (
          f.fn.type !== 'SymbolNode' ||
          !funcs.has(f.fn.name) ||
          f.args.length !== 1
        )
          fail('Unsupported function or argument count: ' + f.fn.name + '.')
        return node(
          f.fn.name === 'log' ? 'ln' : f.fn.name,
          visit(f.args[0], d + 1),
        )
      }
      default:
        return fail('Unsupported syntax: ' + n.type + '.')
    }
  }
  return visit(mathParser(source), 1)
}
export function printSource(
  a: Expr,
  change?: { id: number; value: number },
  prec = 0,
): string {
  if (a.op === 'num') {
    const v = change && a.start === change.id ? change.value : a.value!
    return a.name ?? (v < 0 && prec >= 4 ? '(' + v + ')' : String(v))
  }
  if (a.op === 'u' || a.op === 'param') return a.name ?? 'u'
  if (a.op === 'neg')
    return (
      (prec > 3 ? '(' : '') +
      '-' +
      printSource(a.args[0], change, 3) +
      (prec > 3 ? ')' : '')
    )
  if (a.args.length === 1)
    return a.op + '(' + printSource(a.args[0], change) + ')'
  const p = a.op === '^' ? 4 : a.op === '*' || a.op === '/' ? 2 : 1
  const s =
    printSource(a.args[0], change, p + (a.op === '^' ? 1 : 0)) +
    a.op +
    printSource(a.args[1], change, p + (a.op === '^' ? 0 : 1))
  return p < prec ? '(' + s + ')' : s
}
export function calculate(op: string, a: number, b = 0): number {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '*':
      return a * b
    case '/':
      return a / b
    case '^':
      return a ** b
    case 'neg':
      return -a
    case 'abs':
      return Math.abs(a)
    case 'sqrt':
      return Math.sqrt(a)
    case 'sin':
      return Math.sin(a)
    case 'cos':
      return Math.cos(a)
    case 'tan':
      return Math.tan(a)
    case 'ln':
      return Math.log(a)
    case 'log10':
      return Math.log10(a)
    case 'exp':
      return Math.exp(a)
    default:
      return fail('Unknown operation.')
  }
}
export function evaluate(a: Expr, u: number): number {
  if (a.op === 'num') return a.value!
  if (a.op === 'u') return u
  return calculate(
    a.op,
    evaluate(a.args[0], u),
    a.args[1] ? evaluate(a.args[1], u) : 0,
  )
}
export function format(a: Expr): string {
  if (a.op === 'num') return String(a.value)
  if (a.op === 'param') return a.name!
  if (a.op === 'u') return 'u'
  if (a.op === 'neg') return '(-' + format(a.args[0]) + ')'
  if (a.args.length === 1) return a.op + '(' + format(a.args[0]) + ')'
  return '(' + format(a.args[0]) + a.op + format(a.args[1]) + ')'
}
export interface Control {
  key: string
  label: string
  value: number
  min: number
  max: number
  start?: number
  end?: number
}
export function bind(tree: Expr, values: Parameters) {
  const controls: Control[] = [],
    names = new Set<string>()
  function walk(a: Expr, parent = '', right = false): Expr {
    if (a.op === 'param') {
      const n = a.name!,
        v = values[n] ?? 1
      if (!Number.isFinite(v) || Math.abs(v) > 24)
        fail('Parameters must be between −24 and 24.')
      if (!names.has(n))
        controls.push({ key: n, label: n, value: v, min: -24, max: 24 })
      names.add(n)
      return num(v)
    }
    if (a.op === 'num' && a.start !== undefined && !(parent === '^' && right)) {
      controls.push({
        key: '#' + a.start,
        label: 'k' + (controls.length + 1),
        value: a.value!,
        min: -Math.max(8, Math.abs(a.value!)),
        max: Math.max(8, Math.abs(a.value!)),
        start: a.start,
        end: a.end,
      })
    }
    return { ...a, args: a.args.map((b, i) => walk(b, a.op, i === 1)) }
  }
  const bound = walk(tree)
  if (controls.length > limits.parameters)
    fail('Use at most 12 adjustable coefficients.')
  return { bound, controls }
}
