import type { Command, Option } from 'commander'
import type { GlobalOpts } from '../schemas/global.js'
import { globalOptsSchema } from '../schemas/global.js'
import type { BuildOpts } from '../schemas/build.js'
import { buildOptsSchema } from '../schemas/build.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { fetchOptsSchema } from '../schemas/fetch.js'
import type { PrepareOpts } from '../schemas/prepare.js'
import { prepareOptsSchema } from '../schemas/prepare.js'

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

export function parseOptions<T extends Cmd>(cmd: T, opts: Options[T]) {
  const res = options[cmd].safeParse({
    ...globalOptsSchema.parse(opts).config,
    ...opts,
  })

  if (res.success) {
    return res.data as Options[T]
  }
  throw new Error(`Invalid options: ${res.error}`)
}

export function addOptions(cmd: Command, opts: Option[]) {
  opts.forEach(opt => cmd.addOption(opt))
  return cmd
}
