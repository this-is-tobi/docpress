import { createOption } from 'commander'
import { cliSchema } from '../schemas/global.js'

/**
 * Global command line options shared across all commands
 */
export const globalOpts = [
  createOption('-C, --config <string>', cliSchema.shape.config.description),
  createOption('-T, --token <string>', cliSchema.shape.token.description),
  createOption('-U, --usernames <string>', cliSchema.shape.usernames.description),
]
