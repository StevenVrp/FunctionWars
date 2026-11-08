import { range } from '../math/interval'
import { trajectory, type Weapon, type Point } from '../math/weapon'
export interface Box {
  x: number
  y: number
  w: number
  h: number
}
export interface Target extends Point {
  radius?: number
}
export const RULES = {
  width: 24,
  height: 14,
  playerRadius: 0.55,
  radius: 0.12,
  speed: 12,
  energy: 6,
  hp: 100,
  turns: 30,
  seconds: 60,
  moveCost: 2,
  moveLimit: 2,
}
export interface Collision {
  kind: 'target' | 'obstacle' | 'ground' | 'boundary'
  u: number
  point: Point
  targetIndex?: number
  distance?: number
}
type Bounds = { xl: number; xh: number; yl: number; yh: number }
const ERROR = 1e-7
const gap = (lo: number, hi: number, a: number, b: number) =>
  Math.max(0, lo - b, a - hi)
function bounds(
  w: Weapon,
  o: Point,
  dir: number,
  l: number,
  h: number,
): Bounds {
  let ys: [number, number]
  try {
    ys = range(w.ast, l, h)
  } catch {
    ys = [-Infinity, Infinity]
  }
  return {
    xl: Math.min(o.x + dir * l, o.x + dir * h),
    xh: Math.max(o.x + dir * l, o.x + dir * h),
    yl: o.y + ys[0] - w.offset,
    yh: o.y + ys[1] - w.offset,
  }
}
function circleGap(b: Bounds, t: Point) {
  return Math.hypot(gap(b.xl, b.xh, t.x, t.x), gap(b.yl, b.yh, t.y, t.y))
}
export function resolvePath(
  w: Weapon,
  o: Point,
  dir: number,
  targets: Target[],
  boxes: Box[],
  land: Point[] = [],
  startU = 0,
): Collision {
  const R = RULES.radius,
    end = Math.max(0, Math.min(24, dir > 0 ? 24 - R - o.x : o.x - R))
  let budget = 150000
  const step = () => {
    if (--budget < 0)
      throw Error('Collision budget exceeded. Reduce trajectory curvature.')
  }
  function first(
    l: number,
    h: number,
    lo: (b: Bounds) => number,
    dist: (p: Point) => number,
  ): number | null {
    step()
    const b = bounds(w, o, dir, l, h)
    if (lo(b) > ERROR) return null
    if (dist(trajectory(w, o, dir, l)) <= ERROR) return l
    const m = (l + h) / 2
    if (h - l < 1e-9 || m === l || m === h) {
      for (const t of [m, h])
        if (dist(trajectory(w, o, dir, t)) <= ERROR) return t
      return null
    }
    return first(l, m, lo, dist) ?? first(m, h, lo, dist)
  }
  let hit: Collision = {
    kind: 'boundary',
    u: end,
    point: trajectory(w, o, dir, end),
  }
  function update(kind: Collision['kind'], u: number | null, index?: number) {
    if (
      u === null ||
      u > hit.u + 1e-9 ||
      (kind === 'target' && Math.abs(u - hit.u) < 1e-9 && hit.kind !== 'target')
    )
      return
    hit = { kind, u, point: trajectory(w, o, dir, u), targetIndex: index }
  }
  update(
    'ground',
    first(
      startU,
      hit.u,
      (b) => b.yl - R,
      (p) => p.y - R,
    ),
  )
  update(
    'boundary',
    first(
      startU,
      hit.u,
      (b) => 14 - R - b.yh,
      (p) => 14 - R - p.y,
    ),
  )
  // Sweep the disc against each finite terrain segment. Enclose each path span
  // by a circumscribed disc to bound its possible distance from the segment.
  for (let i = 1; i < land.length; i++) {
    const a = land[i - 1],
      b = land[i],
      dx = b.x - a.x,
      dy = b.y - a.y
    const distance = (x: number, y: number) => {
      const k = Math.max(
        0,
        Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)),
      )
      return Math.hypot(x - a.x - k * dx, y - a.y - k * dy) - R
    }
    const ax = (a.x - o.x) * dir,
      bx = (b.x - o.x) * dir,
      l = Math.max(startU, Math.min(ax, bx) - R),
      h = Math.min(hit.u, Math.max(ax, bx) + R)
    if (l <= h)
      update(
        'ground',
        first(
          l,
          h,
          (s) =>
            Number.isFinite(s.yl + s.yh)
              ? distance((s.xl + s.xh) / 2, (s.yl + s.yh) / 2) -
                Math.hypot(s.xh - s.xl, s.yh - s.yl) / 2
              : -Infinity,
          (p) => distance(p.x, p.y),
        ),
      )
  }
  for (const b of boxes) {
    const rectGap = (x1: number, x2: number, y1: number, y2: number) =>
      Math.hypot(gap(x1, x2, b.x, b.x + b.w), gap(y1, y2, b.y, b.y + b.h)) - R
    update(
      'obstacle',
      first(
        startU,
        hit.u,
        (p) => rectGap(p.xl, p.xh, p.yl, p.yh),
        (p) => rectGap(p.x, p.x, p.y, p.y),
      ),
    )
  }
  targets.forEach((t, i) => {
    const r = (t.radius ?? RULES.playerRadius) + R
    const center = (t.x - o.x) * dir,
      l = Math.max(startU, center - r),
      h = Math.min(hit.u, center + r)
    if (l <= h)
      update(
        'target',
        first(
          l,
          h,
          (b) => circleGap(b, t) - r,
          (p) => Math.hypot(p.x - t.x, p.y - t.y) - r,
        ),
        i,
      )
  })
  if (hit.kind === 'target') {
    const t = targets[hit.targetIndex!],
      r = (t.radius ?? RULES.playerRadius) + R,
      center = (t.x - o.x) * dir
    let best = Infinity
    function minDist(l: number, h: number) {
      step()
      if (circleGap(bounds(w, o, dir, l, h), t) >= best - ERROR) return
      const m = (l + h) / 2
      for (const u of [l, m, h]) {
        const p = trajectory(w, o, dir, u)
        best = Math.min(best, Math.hypot(p.x - t.x, p.y - t.y))
      }
      if (h - l < 1e-8 || best < ERROR) return
      minDist(l, m)
      minDist(m, h)
    }
    minDist(Math.max(startU, center - r), Math.min(end, center + r))
    hit.distance = best
  }
  return hit
}
export function damage(base: number, distance: number) {
  return Math.floor(
    base *
      (distance <= 0.25 + ERROR ? 1.5 : distance <= 0.45 + ERROR ? 1 : 0.5) +
      0.5,
  )
}
