import { tanks, selectTank, type TankId } from './tanks'
import { compile, type Weapon, type Point } from '../math/weapon'
import { resolvePath, damage, type Collision, type Box } from './collision'
import { maps, height } from './maps'
import type { Parameters } from '../math/ast'
export const powers = [
  {
    id: 'shift',
    name: 'Terraform',
    cost: 6,
    help: 'Switch terrain and clear all installed barriers.',
  },
  {
    id: 'wall',
    name: 'Drop barrier',
    cost: 3,
    help: 'Choose a ground position within 9 units. Keep up to 3 barriers.',
  },
  {
    id: 'boost',
    name: 'Overcharge',
    cost: 2,
    help: 'Your next shot deals 8 extra damage if it hits. A miss uses the charge.',
  },
  {
    id: 'nuke',
    name: 'Nuclear strike',
    cost: 9,
    help: 'Deal 16 Tier IV damage and clear cover within 3 units of the enemy. Ward IV blocks the damage.',
  },
  {
    id: 'bank',
    name: 'Capacitor',
    cost: 2,
    help: 'Carry up to 5 unspent energy into the next refill (15 total).',
  },
  {
    id: 'auto',
    name: 'Sentry tank',
    cost: 4,
    help: 'At the next refill, fire a level Tier I shot for 12 damage. Terrain, barriers and Ward I can stop it.',
  },
  ...[0, 1, 2, 3].map((t) => ({
    id: 'shield' + t,
    name: 'Ward ' + ['I', 'II', 'III', 'IV'][t],
    cost: t < 2 ? 2 : 3,
    help: 'Absorb one hit of this tier. Equipping this ward replaces your current ward.',
  })),
]
export interface Setup {
  tanks?: TankId[]
  map: number
  pulse: number
  bans: number[]
  blocked: string[]
}
export const defaultSetup: Setup = { map: 0, pulse: 10, bans: [], blocked: [] }
export interface Pilot extends Point {
  tank?: TankId
  breach?: boolean
  name: string
  hp: number
  energy: number
  ready: number[]
  shield: number | null
  boost: boolean
  bank: boolean
  auto: boolean
  lastRepairPulse?: number
  nextMove: number
}
interface Flight {
  actor: number
  w: Weapon
  start: Point
  dir: number
  hit: Collision
  from: number
  end: number
  boxId?: number
  breach?: boolean
  bonus: number
}
interface Event {
  seq: number
  time: number
  actor: number
  kind: string
  text: string
  at: Point
}
export interface Live {
  setup: Setup
  map: number
  boxes: (Box & { id: number; owner?: number })[]
  nextBox: number
  players: Pilot[]
  flights: Flight[]
  nextPulse: number
  deadline: number
  result: string | null
  winner: number | null
  events: Event[]
  serial: number
}
export type Action =
  | { type: 'fire'; source: string; parameters: Parameters }
  | { type: 'move'; dx: number }
  | { type: 'power'; id: string; x?: number }
  | { type: 'forfeit' }
export function startLive(setup: Setup, names: string[], now: number): Live {
  if (
    !Number.isInteger(setup.map) ||
    !maps[setup.map] ||
    ![5, 8, 10, 15, 20].includes(setup.pulse) ||
    !Array.isArray(setup.bans) ||
    setup.bans.some((i) => ![0, 1, 2, 3].includes(i)) ||
    new Set(setup.bans).size >= 4 ||
    !Array.isArray(setup.blocked) ||
    setup.blocked.length > 100 ||
    setup.blocked.some((x) => typeof x !== 'string' || x.length > 2000)
  )
    throw Error('Invalid match settings.')
  if (setup.tanks && (!Array.isArray(setup.tanks) || setup.tanks.length !== 2))
    throw Error('Select two tanks.')
  const m = maps[setup.map]
  return {
    setup,
    map: setup.map,
    boxes: m.boxes.map((b, id) => ({ ...b, id })),
    nextBox: m.boxes.length,
    players: [2, 22].map((x, i) => ({
      x,
      y: height(m.land, x) + 1,
      name: names[i]?.slice(0, 24) || 'Pilot ' + (i + 1),
      tank: selectTank(setup.tanks?.[i]),
      hp: 100,
      energy: 10,
      ready: [0, 0, 0, 0],
      shield: null,
      boost: false,
      bank: false,
      auto: false,
      nextMove: 0,
    })),
    flights: [],
    nextPulse: now + setup.pulse * 1000,
    deadline: now + 180000,
    result: null,
    winner: null,
    events: [],
    serial: 0,
  }
}
function event(
  s: Live,
  time: number,
  actor: number,
  kind: string,
  text: string,
  at: Point = s.players[actor],
) {
  s.events.push({
    time,
    actor,
    kind,
    text,
    at: { x: at.x, y: at.y },
    seq: ++s.serial,
  })
  s.events = s.events.slice(-16)
}
function finish(s: Live) {
  const diff = s.players[0].hp - s.players[1].hp
  s.winner = diff === 0 ? null : diff > 0 ? 0 : 1
  s.result = s.winner === null ? 'Draw' : s.players[s.winner].name + ' wins'
}
function hurt(s: Live, actor: number, tier: number, amount: number, t: number) {
  const p = s.players[1 - actor]
  if (p.shield === tier) {
    p.shield = null
    event(s, t, 1 - actor, 'block', 'Ward absorbed the hit')
    return
  }
  p.hp = Math.max(0, p.hp - amount)
  event(s, t, 1 - actor, 'damage', '−' + amount + ' HP', p)
}
function impactedBox(s: Live, hit: Collision) {
  return hit.kind === 'obstacle'
    ? s.boxes.find(
        (b) =>
          Math.hypot(
            Math.max(b.x - hit.point.x, 0, hit.point.x - b.x - b.w),
            Math.max(b.y - hit.point.y, 0, hit.point.y - b.y - b.h),
          ) <= 0.120001,
      )?.id
    : undefined
}
function retarget(s: Live, now: number) {
  for (const f of s.flights) {
    const u = Math.max(0, (now - f.from) * 0.012)
    f.hit = resolvePath(
      f.w,
      f.start,
      f.dir,
      [s.players[1 - f.actor]],
      s.boxes,
      maps[s.map].land,
      u,
    )
    f.boxId = impactedBox(s, f.hit)
    f.end = Math.max(now, f.from + f.hit.u / 0.012)
  }
}
export const barrierLimit = 3
export const barrierCost = powers.find((power) => power.id === 'wall')!.cost

export function planBarrier(s: Live, actor: number, center: number) {
  const w = 0.9,
    h = 2.4,
    x = center - w / 2
  const y = height(maps[s.map].land, center)
  const box = { x, y, w, h }
  let reason = ''
  if (
    !Number.isFinite(center) ||
    center < 1 ||
    center > 23 ||
    !Number.isInteger(center * 2)
  )
    reason = 'Choose a half-unit position between 1 and 23.'
  else if (Math.abs(center - s.players[actor].x) > 9)
    reason = 'Choose a position within 9 units of your tank.'
  else if (s.players.some((pilot) => Math.abs(center - pilot.x) < 1.5))
    reason = 'Leave at least 1.5 units between a barrier and either tank.'
  else if (s.boxes.filter((b) => b.owner === actor).length >= barrierLimit)
    reason = 'All three barriers are deployed.'
  else if (
    s.boxes.length >= 18 ||
    s.boxes.some(
      (b) => b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y,
    )
  )
    reason = 'That position is occupied.'
  return { box, reason }
}

const sentryShot = compile('0')
// Process events by absolute time, including ties, before accepting the next action.
export function advance(input: Live, now: number): Live {
  let s = input
  while (!s.result) {
    const t = Math.min(s.nextPulse, s.deadline, ...s.flights.map((f) => f.end))
    if (t > now) break
    if (s === input) s = structuredClone(input)
    const previousBoxes = s.boxes.length
    for (const f of s.flights.filter((f) => f.end === t)) {
      if (f.hit.kind === 'target')
        hurt(
          s,
          f.actor,
          f.w.tier,
          damage(
            f.w.stats.damage *
              tanks[selectTank(s.players[f.actor].tank)].damage,
            f.hit.distance!,
          ) + f.bonus,
          t,
        )
      else if ((f.w.tier === 3 || f.breach) && f.boxId !== undefined) {
        s.boxes = s.boxes.filter((b) => b.id !== f.boxId)
        event(s, t, f.actor, 'shatter', 'Shot shattered cover', f.hit.point)
      } else
        event(s, t, f.actor, 'impact', 'Impact · ' + f.hit.kind, f.hit.point)
    }
    s.flights = s.flights.filter((f) => f.end !== t)
    if (previousBoxes !== s.boxes.length) retarget(s, t)
    if (t === s.nextPulse) {
      s.nextPulse += s.setup.pulse * 1000
      for (const [i, p] of s.players.entries()) {
        p.energy = 10 + (p.bank ? Math.min(5, p.energy) : 0)
        p.bank = false
        if (p.auto) {
          p.auto = false
          const dir = i ? -1 : 1
          const x = Math.max(0.6, Math.min(23.4, p.x - dir * 1.45))
          const land = maps[s.map].land
          const hit = resolvePath(
            sentryShot,
            { x, y: height(land, x) + 1 },
            dir,
            [s.players[1 - i]],
            s.boxes,
            land,
          )
          event(
            s,
            t,
            i,
            'sentry',
            hit.kind === 'target' ? 'Sentry hit' : 'Sentry shot blocked',
            hit.point,
          )
          if (hit.kind === 'target') hurt(s, i, 0, 12, t)
        }
      }
      event(s, t, 0, 'pulse', 'Energy replenished')
    }
    if (t === s.deadline || s.players.some((p) => p.hp === 0)) finish(s)
  }
  return s
}
export function act(input: Live, actor: number, a: Action, now: number): Live {
  if (![0, 1].includes(actor)) throw Error('Unknown pilot.')
  const s = structuredClone(advance(input, now))
  if (s.result) throw Error('Match has ended.')
  const p = s.players[actor],
    enemy = s.players[1 - actor],
    dir = actor ? -1 : 1,
    m = maps[s.map]
  function spend(n: number) {
    if (p.energy < n) throw Error('Insufficient energy.')
    p.energy -= n
  }
  if (a.type === 'forfeit') {
    p.hp = 0
    finish(s)
    return s
  }
  if (a.type === 'fire') {
    const w = compile(a.source, a.parameters)
    if (s.setup.bans.includes(w.tier) || s.setup.blocked.includes(w.canonical))
      throw Error('This weapon is forbidden.')
    if (p.ready[w.tier] > now || s.flights.some((f) => f.actor === actor))
      throw Error('Launcher is cooling down.')
    spend(w.stats.cost)
    const hit = resolvePath(w, p, dir, [enemy], s.boxes, m.land)
    s.flights.push({
      actor,
      w,
      start: { x: p.x, y: p.y },
      dir,
      hit,
      from: now,
      end: now + Math.max(100, (hit.u / 12) * 1000),
      boxId: impactedBox(s, hit),
      bonus: p.boost ? 8 : 0,
      breach: p.breach,
    })
    p.boost = false
    p.breach = false
    p.ready[w.tier] =
      now +
      Math.max(500, w.stats.cooldown * s.setup.pulse * 1000) *
        tanks[selectTank(p.tank)].reload
    event(s, now, actor, 'launch', 'Tier ' + w.stats.roman + ' launched')
    return s
  }
  if (a.type === 'move') {
    const x = p.x + a.dx
    if (
      ![-2, -1, 1, 2].includes(a.dx) ||
      x < 0.55 ||
      x > 23.45 ||
      Math.abs(x - enemy.x) < 1.1 ||
      (x - enemy.x) * (p.x - enemy.x) <= 0 ||
      now < p.nextMove
    )
      throw Error('Movement blocked.')
    for (let j = 0; j <= 40; j++) {
      const xx = p.x + (a.dx * j) / 40,
        yy = height(m.land, xx) + 1
      if (
        s.boxes.some(
          (b) =>
            Math.hypot(
              Math.max(0, b.x - xx, xx - b.x - b.w),
              Math.max(0, b.y - yy, yy - b.y - b.h),
            ) < 0.58,
        )
      )
        throw Error('Barrier blocks movement.')
    }
    spend(2)
    p.x = x
    p.y = height(m.land, x) + 1
    p.nextMove = now + 800
    retarget(s, now)
    event(s, now, actor, 'move', 'Rover repositioned')
    return s
  }
  const power = [...powers, tanks[selectTank(p.tank)].special].find(
    (q) => q.id === a.id,
  )
  if (!power) throw Error('Unknown power.')
  if (
    (a.id === 'bank' && p.bank) ||
    (a.id === 'auto' && p.auto) ||
    (a.id === 'boost' && p.boost)
  )
    throw Error('Already armed.')
  spend(power.cost)
  if (a.id === 'cycle') {
    if (!p.ready.some((t) => t > now))
      throw Error('Launchers are already ready.')
    p.ready.fill(now)
  } else if (a.id === 'breach') {
    if (p.breach) throw Error('Breach charge already armed.')
    p.breach = true
  } else if (a.id === 'repair') {
    if (p.hp === 100) throw Error('Hull is at full health.')
    if (p.lastRepairPulse === s.nextPulse)
      throw Error('Repair recharges at the next refill.')
    p.hp = Math.min(100, p.hp + 12)
    p.lastRepairPulse = s.nextPulse
  } else if (a.id === 'shift') {
    s.map = (s.map + 1) % maps.length
    const n = maps[s.map]
    s.boxes = n.boxes.map((b) => ({ ...b, id: s.nextBox++ }))
    for (const pilot of s.players) {
      pilot.y = height(n.land, pilot.x) + 1
      s.boxes = s.boxes.filter(
        (b) =>
          Math.hypot(
            Math.max(0, b.x - pilot.x, pilot.x - b.x - b.w),
            Math.max(0, b.y - pilot.y, pilot.y - b.y - b.h),
          ) > 0.55,
      )
    }
  } else if (a.id === 'wall') {
    // Clients predating the placement control still send a wall with no coordinate.
    const center = a.x === undefined ? p.x + dir * 3 : a.x
    const { box, reason } = planBarrier(s, actor, center)
    if (reason) throw Error(reason)
    s.boxes.push({ ...box, owner: actor, id: s.nextBox++ })
  } else if (a.id === 'nuke') {
    if (s.setup.bans.includes(3)) throw Error('Tier IV is forbidden.')
    hurt(s, actor, 3, 16, now)
    s.boxes = s.boxes.filter((b) => Math.abs(b.x + b.w / 2 - enemy.x) > 3)
  } else if (a.id === 'bank') p.bank = true
  else if (a.id === 'boost') p.boost = true
  else if (a.id === 'auto') {
    if (s.setup.bans.includes(0)) throw Error('Tier I is forbidden.')
    p.auto = true
  } else {
    const tier = Number(a.id.slice(-1))
    if (p.shield === tier) throw Error('Ward already armed.')
    p.shield = tier
  }
  if (['shift', 'wall', 'nuke'].includes(a.id)) retarget(s, now)
  const place = a.id === 'wall' ? s.boxes.at(-1)! : null
  event(
    s,
    now,
    actor,
    a.id,
    power.name,
    place
      ? { x: place.x + place.w / 2, y: place.y + place.h / 2 }
      : a.id === 'nuke'
        ? enemy
        : p,
  )
  if (enemy.hp === 0) finish(s)
  return s
}

export { selectTank } from './tanks'
