import { describe, expect, it } from 'vitest'
import { globalOptsSchema } from '../schemas/global.js'
import { globalOpts } from './global.js'

// vi.mock('../schemas/global.js', () => ({
//   globalOptsSchema: {
//     shape: {
//       config: {
//         _def: { description: 'Path to the docpress configuration file.' },
//       },
//       token: {
//         _def: { description: 'Git provider token used to collect data' },
//       },
//       username: {
//         _def: { description: 'Git provider username used to collect data.' },
//       },
//     },
//   },
// }))

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
    const expectedDescription = globalOptsSchema.innerType().shape.config._def.description
    expect(option.description).toBe(expectedDescription)
  })
})
