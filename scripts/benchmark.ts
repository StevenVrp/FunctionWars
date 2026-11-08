import { performance } from 'node:perf_hooks'
import { compile } from '../src/math/weapon'
import { puzzles, puzzleShot } from '../src/data/puzzles'
const times: number[] = []
for (let round = 0; round < 30; round++)
  for (const p of puzzles) {
    const start = performance.now()
    const result = puzzleShot(p, compile(p.solution))
    if (!result.success) throw Error('Invalid benchmark case ' + p.id)
    times.push(performance.now() - start)
  }
times.sort((a, b) => a - b)
console.log(
  JSON.stringify(
    {
      shots: times.length,
      median_ms: times[149],
      p95_ms: times[284],
      worst_ms: times[299],
    },
    null,
    2,
  ),
)
