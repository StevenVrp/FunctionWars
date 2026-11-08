import { expect, it } from 'vitest'
import { decode } from '../../src/data/storage'
it('validates every imported expression before acceptance', () => {
  const item = { name: 'Arc', source: 'a*u', parameters: { a: 2 } }
  expect(decode({ version: 1, weapons: [item] })[0].canonical).toContain('u')
  expect(() =>
    decode({ version: 1, weapons: [item, { ...item, source: '1/(u-5)' }] }),
  ).toThrow()
  expect(() => decode({ version: 0, weapons: [] })).toThrow()
})
