import type { Point } from '../math/weapon'
import type { Box } from './collision'
function map(
  title: string,
  art: string,
  tint: string,
  ground: number[],
  boxes: number[][],
) {
  return {
    title,
    art,
    tint,
    land: ground.map((y, i) => ({ x: (i * 24) / (ground.length - 1), y })),
    boxes: boxes.map(([x, y, w, h]) => ({ x, y, w, h }) as Box),
  }
}
export const maps = [
  map(
    'Orbital rift',
    'battlefield-orbit.svg',
    '#8072a9',
    [0, 0, 0.4, 2, 0.4, 0, 0],
    [
      [11, 2, 2, 2],
      [7, 8, 2, 0.4],
    ],
  ),
  map(
    'Glacial shelf',
    'glacier.svg',
    '#8bd4e2',
    [0.2, 0.8, 2.6, 0.7, 0.4, 1.6, 0.2],
    [
      [9, 6, 2.2, 0.6],
      [15, 4.2, 1.5, 0.45],
    ],
  ),
  map(
    'Cinder caldera',
    'volcano.svg',
    '#ed9a83',
    [1, 0.4, 1.5, 3.6, 0.8, 0.3, 1],
    [
      [6.8, 5.6, 1, 0.8],
      [16, 6.5, 2, 0.7],
    ],
  ),
  map(
    'Canopy station',
    'canopy.svg',
    '#7cc8a1',
    [0.2, 0.7, 1.6, 0.2, 2.2, 0.7, 0.3],
    [
      [7, 4.4, 3, 0.5],
      [13, 6.4, 3, 0.45],
      [15, 2, 1.3, 1],
    ],
  ),
  map(
    'Orbital shipyard',
    'orbit-yard.svg',
    '#deb987',
    [0.8, 1.6, 0.2, 0.2, 0.2, 2, 0.6],
    [
      [8, 4.4, 1.4, 0.8],
      [11, 7.5, 2, 0.5],
      [15, 3, 1, 0.7],
    ],
  ),
  map('Open range', 'battlefield-orbit.svg', '#8072a9', [0, 0], []),
]
export function height(land: Point[], x: number) {
  const i = land.findIndex((p) => p.x >= x)
  if (i < 0) return land.at(-1)!.y
  if (i === 0) return land[0].y
  const a = land[i - 1],
    b = land[i]
  return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)
}
