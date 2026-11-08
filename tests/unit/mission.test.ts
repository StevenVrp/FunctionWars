import { it, expect } from 'vitest'
import { mission, missionReduce } from '../../src/combat/mission'
import { puzzles } from '../../src/data/puzzles'
it('counts resolving shots once and closes a spent mission', () => {
  let s = mission(puzzles[0], 'test')
  for (let i = 0; i < puzzles[0].budget; i++) {
    s = missionReduce(s, { type: 'FIRE', source: '0', parameters: {} })
    expect(() =>
      missionReduce(s, { type: 'FIRE', source: '0', parameters: {} }),
    ).toThrow()
    s = missionReduce(s, { type: 'RESOLVE_SHOT' })
  }
  expect(s.outcome).toBe(0)
  expect(s.shots).toBe(4)
  expect(() =>
    missionReduce(s, { type: 'FIRE', source: '0', parameters: {} }),
  ).toThrow()
  expect(missionReduce(s, { type: 'RESTART_MATCH' })).toEqual(
    mission(puzzles[0], 'test'),
  )
})
it('replays an in-flight saved state and preserves the verified solution', () => {
  const p = puzzles[9],
    s = missionReduce(mission(p, 'test'), {
      type: 'FIRE',
      source: p.solution,
      parameters: {},
    })
  expect(
    missionReduce(JSON.parse(JSON.stringify(s)), { type: 'RESOLVE_SHOT' }),
  ).toEqual(missionReduce(s, { type: 'RESOLVE_SHOT' }))
  expect(missionReduce(s, { type: 'RESOLVE_SHOT' }).outcome).toBe(3)
})
