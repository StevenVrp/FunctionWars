import { compile, type Point, type Weapon } from '../math/weapon'
import type { Parameters } from '../math/ast'
import {
  resolvePath,
  damage,
  RULES,
  type Box,
  type Collision,
} from './collision'
export interface Player extends Point {
  name: string
  hp: number
  energy: number
  cooldowns: number[]
  personalTurn: number
  moved: boolean
  source: string
  parameters: Parameters
}
export interface Projectile {
  w: Weapon
  start: Point
  dir: number
  hit: Collision
}
export interface Match {
  schemaVersion: 1
  matchId: string
  mode: 'duel'
  phase: 'planning' | 'flight' | 'over'
  players: [Player, Player]
  current: number
  turn: number
  remaining: number
  obstacles: Box[]
  weapon: Weapon
  projectile: Projectile | null
  lastHit: Collision | null
  lastDamage: number
  outcome: string | null
  history: string[]
}
export const arenas: Record<string, Box[]> = {
  Rift: [{ x: 11.25, y: 0, w: 1.5, h: 3.2 }],
  Twin: [
    { x: 8, y: 0, w: 1, h: 2.4 },
    { x: 15, y: 0, w: 1, h: 2.4 },
  ],
  Open: [],
}
const starter = 'a*u*(1-u/20)'
export function match(
  id: string,
  names = ['Nova', 'Vega'],
  obstacles = arenas.Rift,
): Match {
  const makePlayer = (name: string, i: number): Player => ({
    name,
    x: i ? 22 : 2,
    y: 1,
    hp: RULES.hp,
    energy: RULES.energy,
    cooldowns: [0, 0, 0, 0],
    personalTurn: i ? 0 : 1,
    moved: false,
    source: starter,
    parameters: { a: 1.25 },
  })
  const players: [Player, Player] = [
    makePlayer(names[0] ?? 'Nova', 0),
    makePlayer(names[1] ?? 'Vega', 1),
  ]
  return {
    schemaVersion: 1,
    matchId: id,
    mode: 'duel',
    phase: 'planning',
    players,
    current: 0,
    turn: 1,
    remaining: 60,
    obstacles,
    weapon: compile(starter, { a: 1.25 }),
    projectile: null,
    lastHit: null,
    lastDamage: 0,
    outcome: null,
    history: ['Turn 1 · ' + names[0] + ' opens fire.'],
  }
}
export type Command =
  | {
      type: 'SELECT_FUNCTION' | 'UPDATE_EXPRESSION' | 'UPDATE_PARAMETERS'
      source: string
      parameters: Parameters
      actor: number
    }
  | { type: 'FIRE' | 'END_TURN' | 'MOVE_PLAYER'; actor: number; delta?: number }
  | { type: 'RESOLVE_SHOT' | 'TIMER_EXPIRED' | 'RESTART_MATCH' }
  | { type: 'TICK'; seconds: number }
function requireRule(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message)
}
function endTurn(s: Match): Match {
  if (s.turn === RULES.turns) {
    const [a, b] = s.players
    const outcome =
      a.hp === b.hp ? 'Draw' : (a.hp > b.hp ? a : b).name + ' wins'
    return { ...s, phase: 'over', outcome, history: [...s.history, outcome] }
  }
  const current = 1 - s.current,
    players = [...s.players] as [Player, Player],
    p = players[current]
  players[current] = {
    ...p,
    moved: false,
    energy: 6,
    personalTurn: p.personalTurn + 1,
  }
  return {
    ...s,
    turn: s.turn + 1,
    current,
    players,
    remaining: 60,
    phase: 'planning',
    projectile: null,
    weapon: compile(p.source, p.parameters),
    history: [
      ...s.history,
      'Turn ' + (s.turn + 1) + ' · ' + p.name + ' is planning.',
    ],
  }
}
export function cooldown(p: Player, tier: number) {
  return Math.max(0, p.cooldowns[tier] - p.personalTurn)
}
export function reduce(s: Match, c: Command): Match {
  if (c.type === 'RESTART_MATCH')
    return match(
      s.matchId,
      s.players.map((p) => p.name),
      s.obstacles,
    )
  if ('actor' in c) requireRule(c.actor === s.current, 'Wait for your turn.')
  const p = s.players[s.current],
    enemy = s.players[1 - s.current]
  const players = [...s.players] as [Player, Player]
  if (c.type === 'RESOLVE_SHOT') {
    requireRule(
      s.phase === 'flight' && s.projectile,
      'No projectile to resolve.',
    )
    const { hit, w } = s.projectile
    const loss =
      hit.kind === 'target' ? damage(w.stats.damage, hit.distance!) : 0
    players[1 - s.current] = { ...enemy, hp: Math.max(0, enemy.hp - loss) }
    const info =
      (loss
        ? 'Hit · ' + loss + ' damage to ' + enemy.name
        : 'Miss · ' + hit.kind) +
      ' at (' +
      hit.point.x.toFixed(2) +
      ', ' +
      hit.point.y.toFixed(2) +
      ') · Tier ' +
      w.stats.roman +
      ' · cooldown ' +
      w.stats.cooldown +
      'T'
    let next: Match = {
      ...s,
      players,
      projectile: null,
      lastHit: hit,
      lastDamage: loss,
      phase: 'planning',
      history: [...s.history, info],
    }
    if (!players[1 - s.current].hp)
      return { ...next, phase: 'over', outcome: p.name + ' wins' }
    if (p.energy < 2 || s.remaining <= 0) next = endTurn(next)
    return next
  }
  requireRule(
    s.phase === 'planning',
    'This command requires an active planning turn.',
  )
  if (c.type === 'TIMER_EXPIRED') return endTurn({ ...s, remaining: 0 })
  if (c.type === 'END_TURN') return endTurn(s)
  if (c.type === 'TICK') {
    requireRule(
      Number.isFinite(c.seconds) && c.seconds > 0,
      'Invalid timer step.',
    )
    const remaining = Math.max(0, s.remaining - c.seconds)
    return remaining ? { ...s, remaining } : endTurn({ ...s, remaining: 0 })
  }
  if (
    c.type === 'UPDATE_EXPRESSION' ||
    c.type === 'UPDATE_PARAMETERS' ||
    c.type === 'SELECT_FUNCTION'
  ) {
    const weapon = compile(c.source, c.parameters)
    players[s.current] = {
      ...p,
      source: c.source,
      parameters: { ...c.parameters },
    }
    return { ...s, weapon, players }
  }
  if (c.type === 'MOVE_PLAYER') {
    const delta = c.delta ?? 0,
      x = p.x + delta
    requireRule(
      !p.moved && p.energy >= RULES.moveCost,
      'Movement requires 2 energy and is available once per turn.',
    )
    requireRule(
      Number.isFinite(delta) &&
        delta !== 0 &&
        Math.abs(delta) <= 2 &&
        x >= 0.55 &&
        x <= 23.45,
      'Move up to 2 units within the arena.',
    )
    const lo = Math.min(p.x, x),
      hi = Math.max(p.x, x)
    for (const b of s.obstacles) {
      const dx = Math.max(0, b.x - hi, lo - b.x - b.w),
        dy = Math.max(0, b.y - p.y, p.y - b.y - b.h)
      requireRule(Math.hypot(dx, dy) > 0.55, 'Terrain blocks this move.')
    }
    requireRule(
      Math.hypot(Math.max(0, enemy.x - hi, lo - enemy.x), p.y - enemy.y) > 1.1,
      'Another rover blocks this move.',
    )
    players[s.current] = { ...p, x, moved: true, energy: p.energy - 2 }
    const next = {
      ...s,
      players,
      history: [...s.history, p.name + ' moved to x = ' + x + '.'],
    }
    return players[s.current].energy < 2 ? endTurn(next) : next
  }
  if (c.type === 'FIRE') {
    const w = s.weapon
    requireRule(p.energy >= w.stats.cost, 'Insufficient energy.')
    requireRule(
      !cooldown(p, w.tier),
      'Tier ' + w.stats.roman + ' is cooling down.',
    )
    const dir = s.current ? -1 : 1,
      start = { x: p.x, y: p.y },
      hit = resolvePath(w, start, dir, [enemy], s.obstacles)
    const cooldowns = [...p.cooldowns]
    if (w.stats.cooldown)
      cooldowns[w.tier] = p.personalTurn + w.stats.cooldown + 1
    players[s.current] = { ...p, energy: p.energy - w.stats.cost, cooldowns }
    return {
      ...s,
      phase: 'flight',
      players,
      lastHit: null,
      lastDamage: 0,
      projectile: { w, start, dir, hit },
    }
  }
  return s
}
