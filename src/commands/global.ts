import { createOption } from 'commander'
import { baseCliSchema } from '../schemas/global.js'

export const globalOpts = [
  createOption('-C, --config <string>', baseCliSchema.shape.config.description),
  createOption('-T, --token <string>', baseCliSchema.shape.token.description),
  createOption('-U, --usernames <string>', baseCliSchema.shape.usernames.description),
]
