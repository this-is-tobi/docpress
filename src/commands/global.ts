import { createOption } from 'commander'
import { globalOptsSchema } from '../schemas/global.js'

export const globalOpts = [
  createOption('-C, --config <string>', globalOptsSchema.innerType().shape.config._def.description),
  createOption('-T, --token <string>', globalOptsSchema.innerType().shape.token._def.description),
  createOption('-U, --usernames <string>', globalOptsSchema.innerType().shape.usernames._def.description),
]
