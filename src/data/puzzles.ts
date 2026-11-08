import expedition from './expedition.json'
import { compile, trajectory, type Point, type Weapon } from '../math/weapon'
import { resolvePath, type Box, type Collision } from '../combat/collision'
export interface Puzzle {
  id: number
  name: string
  concept: string
  difficulty: string
  objective: string
  origin: Point
  target: Point
  boxes: Box[]
  gate?: Point
  allowed: string[]
  required: string[]
  nested?: boolean
  budget: number
  par: number
  precision: number
  hint: string
  solution: string
  starter: string
}
const origin = { x: 2, y: 1 }
const levels: Omit<
  Puzzle,
  'id' | 'difficulty' | 'budget' | 'par' | 'precision'
>[] = [
  {
    name: 'First Contact',
    concept: 'Linear slope',
    origin,
    target: { x: 14, y: 7 },
    boxes: [],
    allowed: ['Linear'],
    required: ['Linear'],
    objective: 'Hit the beacon at (14, 7) with a line.',
    hint: 'The beacon is 12 units to your right and 6 units higher. Slope is rise divided by run.',
    solution: '0.5*u',
    starter: 'a*u',
  },
  {
    name: 'Descending Signal',
    concept: 'Negative gradient',
    origin: { x: 2, y: 8 },
    target: { x: 16, y: 2.4 },
    boxes: [],
    allowed: ['Linear'],
    required: ['Linear'],
    objective: 'Reach the lower beacon at (16, 2.4).',
    hint: 'Your launch height is 8. A negative slope trades altitude for horizontal distance.',
    solution: '-0.4*u',
    starter: 'a*u',
  },
  {
    name: 'Arc Reactor',
    concept: 'Quadratic curvature',
    origin,
    target: { x: 12, y: 6 },
    boxes: [],
    allowed: ['Quadratic'],
    required: ['Quadratic'],
    objective: 'Hit (12, 6) using a quadratic curve.',
    hint: 'At the beacon u = 10. For g(u) = a·u², changing a changes the rise over that distance.',
    solution: '0.05*u^2',
    starter: 'a*u^2',
  },
  {
    name: 'Return to Zero',
    concept: 'Roots and intersections',
    origin,
    target: { x: 18, y: 1 },
    boxes: [{ x: 9.6, y: 0, w: 0.8, h: 3.6 }],
    allowed: ['Quadratic'],
    required: ['Quadratic'],
    objective: 'Clear the barrier and return to launch height at (18, 1).',
    hint: 'A factored parabola can have a root at launch and a second root 16 units away.',
    solution: '0.08*u*(16-u)',
    starter: '0.12*u*(a-u)',
  },
  {
    name: 'At the Apex',
    concept: 'Vertex form',
    origin,
    target: { x: 12, y: 7 },
    gate: { x: 7, y: 5.5 },
    boxes: [],
    allowed: ['Quadratic'],
    required: ['Quadratic'],
    objective: 'Pass the gate at (7, 5.5) and hit the apex beacon at (12, 7).',
    hint: 'Center the parabola at u = 10. The vertex must rise 6 units above the launch position.',
    solution: '-0.06*(u-10)^2',
    starter: '-0.04*(u-a)^2',
  },
  {
    name: 'Twin Spires',
    concept: 'Obstacle clearance',
    origin,
    target: { x: 22, y: 1 },
    boxes: [
      { x: 7, y: 0, w: 1, h: 3.5 },
      { x: 16, y: 0, w: 1, h: 3.5 },
    ],
    allowed: ['Quadratic', 'Polynomial'],
    required: [],
    objective: 'Thread a shot over both spires into (22, 1).',
    hint: 'A symmetric arc with roots at 0 and 20 can clear both spires. Adjust its height.',
    solution: '0.07*u*(20-u)',
    starter: '0.03*u*(20-u)',
  },
  {
    name: 'Crest Signal',
    concept: 'Sine amplitude',
    origin,
    target: { x: 8, y: 5 },
    boxes: [],
    allowed: ['Trig'],
    required: ['Trig'],
    objective: 'Place a wave crest on the beacon at (8, 5).',
    hint: 'A sine wave reaches its first crest when its argument is π/2. Amplitude sets the height.',
    solution: '4*sin(pi*u/12)',
    starter: 'a*sin(pi*u/12)',
  },
  {
    name: 'Phase Shift',
    concept: 'Frequency and phase',
    origin,
    target: { x: 14, y: 1 },
    gate: { x: 8, y: 5 },
    boxes: [],
    allowed: ['Trig'],
    required: ['Trig'],
    objective: 'Pass (8, 5) before returning to the beacon at (14, 1).',
    hint: 'Try starting a cosine at a trough. Half a period later it will have risen by twice its amplitude.',
    solution: '-2*cos(pi*u/6)',
    starter: 'a*cos(b*u)',
  },
  {
    name: 'Folded Signal',
    concept: 'Nested composition',
    origin,
    target: { x: 14, y: 1 },
    gate: { x: 8, y: 4.29 },
    boxes: [{ x: 7.8, y: 0, w: 0.4, h: 2.7 }],
    allowed: [
      'Radical',
      'Absolute',
      'Trig',
      'Logarithmic',
      'Exponential',
      'Quadratic',
      'Polynomial',
    ],
    required: [],
    nested: true,
    objective:
      'Use a composite curve to clear the center gate and return to (14, 1).',
    hint: 'Inside a square root, |u − 6| creates symmetry around u = 6. Reflect and scale the result to lift the center.',
    solution: '-2*sqrt(abs(u-6)+1)',
    starter: '-1*sqrt(abs(u-6)+1)',
  },
  {
    name: 'Orbital Finale',
    concept: 'Mixed-family synthesis',
    origin,
    target: { x: 18, y: 1 },
    gate: { x: 6, y: 5.4 },
    boxes: [{ x: 5.5, y: 0, w: 1, h: 3.1 }],
    allowed: ['Trig', 'Quadratic'],
    required: ['Trig', 'Quadratic'],
    objective:
      'Combine a wave and a quadratic to pass (6, 5.4) and hit (18, 1).',
    hint: 'Give the parabola roots at 0 and 16. Add a sine wave that peaks at u = 4 and vanishes at u = 16.',
    solution: '0.05*u*(16-u)+2*sin(pi*u/8)',
    starter: '0.05*u*(16-u)+a*sin(pi*u/8)',
  },
]
export const puzzles: Puzzle[] = [...levels, ...expedition].map((p, i) => ({
  ...p,
  id: i + 1,
  difficulty: i < 3 ? 'Introductory' : i < 7 ? 'Intermediate' : 'Advanced',
  budget: i < 4 ? 4 : 5,
  par: i < 4 ? 2 : 3,
  precision: 0.25,
}))
export function puzzleRule(p: Puzzle, w: Weapon): string {
  if (
    w.families.some((f) => !p.allowed.includes(f)) ||
    p.required.some((f) => !w.families.includes(f))
  )
    return (
      'This mission requires ' +
      (p.required.length ? p.required : p.allowed).join(' / ') +
      '.'
    )
  if (p.nested && !w.nested) return 'Use a nested composition for this mission.'
  return ''
}
export function puzzleShot(p: Puzzle, w: Weapon) {
  const error = puzzleRule(p, w)
  if (error) throw Error(error)
  const hit = resolvePath(w, p.origin, 1, [p.target], p.boxes)
  const gate = p.gate,
    passed =
      !gate ||
      (hit.u >= gate.x - p.origin.x &&
        Math.abs(trajectory(w, p.origin, 1, gate.x - p.origin.x).y - gate.y) <=
          0.45)
  return { hit, passed, success: hit.kind === 'target' && passed }
}
export function stars(p: Puzzle, shots: number, hit: Collision) {
  return (
    1 +
    (shots <= p.par
      ? 1 + Number((hit.distance ?? Infinity) <= p.precision + 1e-7)
      : 0)
  )
}
