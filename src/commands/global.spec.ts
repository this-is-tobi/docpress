import { describe, expect, it, vi } from 'vitest'
import { globalOptsSchema } from '../schemas/global.js'
import { globalOpts } from './global.js'

vi.mock('../schemas/global.js', () => ({
  globalOptsSchema: {
    shape: {
      config: {
        _def: { description: 'Path to the configuration file' },
      },
    },
  },
}))

describe('globalOpts', () => {
  it('should contain one option', () => {
    expect(globalOpts).toHaveLength(1)
  })

  it('should define the correct option with flags and argument', () => {
    const option = globalOpts[0]
    expect(option.flags).toBe('-C, --config <string>')
  })

  it('should have the correct description from the schema', () => {
    const option = globalOpts[0]
    const expectedDescription = globalOptsSchema.shape.config._def.description
    expect(option.description).toBe(expectedDescription)
  })
})
