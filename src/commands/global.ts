import { createOption } from 'commander'
import { globalOptsSchema } from '../schemas/global.js'

export const globalOpts = [
  createOption('-C, --config <string>', globalOptsSchema.shape.config._def.description),
]
