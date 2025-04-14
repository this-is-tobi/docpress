import type { Command, Option } from 'commander'
import { fromZodError } from 'zod-validation-error'
import type { GlobalOpts, RawCli } from '../schemas/global.js'
import { globalOptsSchema } from '../schemas/global.js'
import type { BuildOpts } from '../schemas/build.js'
import { buildOptsSchema } from '../schemas/build.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { fetchOptsSchema } from '../schemas/fetch.js'
import type { PrepareOpts } from '../schemas/prepare.js'
import { prepareOptsSchema } from '../schemas/prepare.js'
import { log } from './logger.js'

type Cmd = 'fetch' | 'build' | 'prepare' | 'global'

interface Options {
  build: BuildOpts
  fetch: FetchOpts
  prepare: PrepareOpts
  global: GlobalOpts
}

export const options = {
  build: buildOptsSchema,
  fetch: fetchOptsSchema,
  prepare: prepareOptsSchema,
  global: globalOptsSchema,
}

export function parseOptions<T extends Cmd>(cmd: T, opts: RawCli) {
  log(`Initializing Docpress...`, 'info', 'blue')
  log(`\n\n-> Checking for required environment settings and configurations.`, 'info')

  const res = options[cmd].safeParse(opts)
  if (res.error) {
    log(`   An error occurred while checking configuration.\n     ${fromZodError(res.error).toString()}`, 'error')
    process.exit(1)
  }
  log('   Setup complete! Ready to process your documentation.', 'info')
  return res.data as Options[T]
}

export function addOptions(cmd: Command, opts: Option[]) {
  opts.forEach(opt => cmd.addOption(opt))
  return cmd
}
