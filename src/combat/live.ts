import { tanks, selectTank, type TankId } from './tanks'
import { compile, type Weapon, type Point } from '../math/weapon'
import { resolvePath, damage, type Collision, type Box } from './collision'
import { maps, height } from './maps'
import type { Parameters } from '../math/ast'
export const powers = [
  {
    id: 'shift',
    name: 'Terraform',
    cost: 4,
    help: 'Cycle to the next landscape and its barriers.',
  },
  {
    id: 'wall',
    name: 'Drop barrier',
    cost: 3,
    help: 'Place cover ahead of your tank.',
  },
  {
    id: 'boost',
    name: 'Overcharge',
    cost: 3,
    help: 'Add 10 damage to your next hit.',
  },
  {
    id: 'nuke',
    name: 'Nuclear strike',
    cost: 9,
    help: 'Deal 18 damage and erase nearby cover.',
  },
  {
    id: 'bank',
    name: 'Capacitor',
    cost: 2,
    help: 'Carry unused energy into the next refill (cap 20).',
  },
  {
    id: 'auto',
    name: 'Sentry tank',
    cost: 5,
    help: 'At the next refill, deal a guaranteed Tier I center hit. Tier I shields absorb it.',
  },
  ...[0, 1, 2, 3].map((t) => ({
    id: 'shield' + t,
    name: 'Ward ' + ['I', 'II', 'III', 'IV'][t],
    cost: t + 2,
    help: 'Absorb one hit of this exact tier.',
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
  boxes: (Box & { id: number })[]
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
  | { type: 'power'; id: string }
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
        event(s, t, f.actor, 'shatter', 'Tier IV shattered cover', f.hit.point)
      } else
        event(s, t, f.actor, 'impact', 'Impact · ' + f.hit.kind, f.hit.point)
    }
    s.flights = s.flights.filter((f) => f.end !== t)
    if (previousBoxes !== s.boxes.length) retarget(s, t)
    if (t === s.nextPulse) {
      s.nextPulse += s.setup.pulse * 1000
      for (const [i, p] of s.players.entries()) {
        p.energy = Math.min(20, 10 + (p.bank ? p.energy : 0))
        p.bank = false
        if (p.auto) {
          p.auto = false
          event(s, t, i, 'sentry', 'Sentry locked on', s.players[1 - i])
          hurt(s, i, 0, 21, t)
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
      bonus: p.boost ? 10 : 0,
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
    p.hp = Math.min(100, p.hp + 16)
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
    const x = p.x + dir * 3 - 0.45,
      y = height(m.land, x + 0.45)
    if (
      x < 0 ||
      x + 1 > 24 ||
      Math.abs(x + 0.45 - enemy.x) < 1.5 ||
      s.boxes.length >= 18 ||
      s.boxes.some(
        (b) => b.x < x + 0.9 && b.x + b.w > x && b.y < y + 2.4 && b.y + b.h > y,
      )
    )
      throw Error('No room for a barrier.')
    s.boxes.push({ x, y, w: 0.9, h: 2.4, id: s.nextBox++ })
  } else if (a.id === 'nuke') {
    hurt(s, actor, 3, 18, now)
    s.boxes = s.boxes.filter((b) => Math.abs(b.x + b.w / 2 - enemy.x) > 5)
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
