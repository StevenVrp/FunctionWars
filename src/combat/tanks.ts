export const tanks = {
  vector: {
    name: 'Vector',
    role: 'Recon',
    sprite: 'tank-vector.svg',
    color: '#70e8f2',
    damage: 0.85,
    reload: 0.7,
    special: {
      id: 'cycle',
      name: 'Rapid cycle',
      cost: 4,
      help: 'Clear all weapon cooldowns. Your active projectile must still land.',
    },
  },
  bastion: {
    name: 'Bastion',
    role: 'Siege',
    sprite: 'tank-bastion.svg',
    color: '#ffc274',
    damage: 1.25,
    reload: 1.3,
    special: {
      id: 'breach',
      name: 'Breach charge',
      cost: 3,
      help: 'Your next shot can destroy cover at any tier.',
    },
  },
  warden: {
    name: 'Warden',
    role: 'Support',
    sprite: 'tank-warden.svg',
    color: '#c3a0ff',
    damage: 1,
    reload: 1,
    special: {
      id: 'repair',
      name: 'Field repair',
      cost: 4,
      help: 'Repair up to 16 lost HP.',
    },
  },
} as const
export type TankId = keyof typeof tanks
export function selectTank(id: unknown): TankId {
  if (id === undefined) return 'warden'
  if (typeof id === 'string' && Object.hasOwn(tanks, id)) return id as TankId
  throw Error('Unknown tank chassis.')
}
