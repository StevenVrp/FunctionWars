import { compile, type Weapon } from '../math/weapon'
import type { Parameters } from '../math/ast'
export interface Saved {
  id: string
  name: string
  source: string
  parameters: Parameters
  canonical: string
  families: string[]
  color: string
  created: string
  modified: string
}
export const key = 'function-wars.v1.'
export function read<T>(id: string, initial: T): T {
  try {
    return JSON.parse(localStorage.getItem(key + id) ?? 'null') ?? initial
  } catch {
    return initial
  }
}
export function write(id: string, value: unknown) {
  localStorage.setItem(key + id, JSON.stringify(value))
}
export function record(w: Weapon, name: string, color = '#ad99ff'): Saved {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 40) || 'Unnamed weapon',
    source: w.source,
    parameters: w.parameters,
    canonical: w.canonical,
    families: w.families,
    color,
    created: now,
    modified: now,
  }
}
export function decode(input: unknown): Saved[] {
  const data = input as { version?: number; weapons?: unknown[] }
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.weapons) ||
    data.weapons.length > 100
  )
    throw Error('Expected a version 1 arsenal with up to 100 weapons.')
  return data.weapons.map((item) => {
    const s = item as Saved
    if (
      !s ||
      typeof s.name !== 'string' ||
      s.name.length > 40 ||
      !s.name.trim() ||
      typeof s.source !== 'string' ||
      !s.parameters ||
      typeof s.parameters !== 'object' ||
      Array.isArray(s.parameters) ||
      Object.entries(s.parameters).some(
        ([k, v]) =>
          !(
            /^[a-df-hj-np-tvw-z]$/.test(k) &&
            typeof v === 'number' &&
            Number.isFinite(v) &&
            Math.abs(v) <= 24
          ),
      )
    )
      throw Error('Invalid weapon name, expression, or parameters.')
    const w = compile(s.source, s.parameters)
    const r = record(
      w,
      s.name,
      /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : undefined,
    )
    return {
      ...r,
      id: typeof s.id === 'string' && /^[\w-]{1,64}$/.test(s.id) ? s.id : r.id,
      created: Number.isFinite(Date.parse(s.created)) ? s.created : r.created,
      modified: Number.isFinite(Date.parse(s.modified))
        ? s.modified
        : r.modified,
    }
  })
}
