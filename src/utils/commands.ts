import type { Command, Option } from 'commander'
import type { BuildOpts } from '../schemas/build.js'
import { buildOptsSchema } from '../schemas/build.js'
import type { FetchOpts } from '../schemas/fetch.js'
import { fetchOptsSchema } from '../schemas/fetch.js'
import type { PrepareOpts } from '../schemas/prepare.js'
import { prepareOptsSchema } from '../schemas/prepare.js'

type Cmd = 'fetch' | 'build' | 'prepare'

interface Options {
  build: BuildOpts
  fetch: FetchOpts
  prepare: PrepareOpts
}

export const options = {
  build: buildOptsSchema,
  fetch: fetchOptsSchema,
  prepare: prepareOptsSchema,
}

export function parseOptions<T extends Cmd | Cmd[]>(
  cmd: T,
  opts: T extends Cmd[] ? Options[T[number]] : Options[T & Cmd],
) {
  if (Array.isArray(cmd)) {
    return cmd.reduce((acc, cur) => {
      return {
        ...acc,
        ...options[cur].parse(opts),
      }
    }, {})
  } else {
    return options[cmd as Cmd].parse(opts)
  }
}

export function addOptions(cmd: Command, opts: Option[]) {
  opts.forEach(opt => cmd.addOption(opt))
  return cmd
}
