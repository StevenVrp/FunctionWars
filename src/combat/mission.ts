import { compile, type Weapon } from '../math/weapon'
import { puzzleShot, stars, type Puzzle } from '../data/puzzles'
import type { Parameters } from '../math/ast'
import type { Projectile } from './state'
import type { Collision } from './collision'
export interface MissionState {
  schemaVersion: 1
  matchId: string
  mode: 'puzzle'
  objective: Puzzle
  phase: 'planning' | 'flight' | 'over'
  shots: number
  weapon: Weapon | null
  projectile: (Projectile & { success: boolean; passed: boolean }) | null
  lastHit: Collision | null
  outcome: number | null
  history: string[]
}
export function mission(p: Puzzle, id: string): MissionState {
  return {
    schemaVersion: 1,
    matchId: id,
    mode: 'puzzle',
    objective: p,
    phase: 'planning',
    shots: 0,
    weapon: null,
    projectile: null,
    lastHit: null,
    outcome: null,
    history: [],
  }
}
export type MissionCommand =
  | { type: 'FIRE'; source: string; parameters: Parameters }
  | { type: 'RESOLVE_SHOT' | 'RESTART_MATCH' }
export function missionReduce(
  s: MissionState,
  c: MissionCommand,
): MissionState {
  if (c.type === 'RESTART_MATCH') return mission(s.objective, s.matchId)
  if (c.type === 'FIRE') {
    if (s.phase !== 'planning' || s.shots >= s.objective.budget)
      throw Error('No shot is available.')
    const w = compile(c.source, c.parameters),
      attempt = puzzleShot(s.objective, w)
    return {
      ...s,
      weapon: w,
      shots: s.shots + 1,
      phase: 'flight',
      lastHit: null,
      projectile: { ...attempt, w, start: s.objective.origin, dir: 1 },
    }
  }
  const f = s.projectile
  if (s.phase !== 'flight' || !f) throw Error('No projectile to resolve.')
  const outcome = f.success
    ? stars(s.objective, s.shots, f.hit)
    : s.shots >= s.objective.budget
      ? 0
      : null
  const label = f.success
    ? 'Beacon hit. '
    : !f.passed
      ? 'Gate missed. '
      : f.hit.kind === 'obstacle'
        ? 'Barrier blocked the shot. '
        : 'Beacon missed. '
  const feedback =
    label +
    'Impact at (' +
    f.hit.point.x.toFixed(2) +
    ', ' +
    f.hit.point.y.toFixed(2) +
    ').'
  return {
    ...s,
    phase: outcome === null ? 'planning' : 'over',
    outcome,
    lastHit: f.hit,
    projectile: null,
    history: [...s.history, feedback],
  }
}
