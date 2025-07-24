import { describe, expect, it } from 'vitest'
import { baseCliSchema } from '../schemas/global.js'
import { globalOpts } from './global.js'

describe('globalOpts', () => {
  it('should contain 3 options', () => {
    expect(globalOpts).toHaveLength(3)
  })

  it('should define the correct option with flags and argument', () => {
    expect(globalOpts[0].flags).toBe('-C, --config <string>')
    expect(globalOpts[1].flags).toBe('-T, --token <string>')
    expect(globalOpts[2].flags).toBe('-U, --usernames <string>')
  })

  it('should have the correct description from the schema', () => {
    const option = globalOpts[0]
    // In Zod v4, when description is undefined it returns empty string
    expect(option.description).toBe(baseCliSchema.shape.config.description || '')
  })
})
