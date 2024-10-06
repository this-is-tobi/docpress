import type { Command, Option } from 'commander'
import { optionsSchema as buildOptions } from '../build/schemas.js'
import type { Options as BuildOptions } from '../build/schemas.js'
import { optionsSchema as fetchOptions } from '../fetch/schemas.js'
import type { Options as FetchOptions } from '../fetch/schemas.js'
import { optionsSchema as prepareOptions } from '../prepare/schemas.js'
import type { Options as PrepareOptions } from '../prepare/schemas.js'

type Cmd = 'fetch' | 'build' | 'prepare'

interface Options {
  build: BuildOptions
  fetch: FetchOptions
  prepare: PrepareOptions
}

export const options = {
  build: buildOptions,
  fetch: fetchOptions,
  prepare: prepareOptions,
}

export function parseOptions<T extends Cmd | Cmd[]>(
  cmd: T,
  opts: T extends Cmd[] ? Options[T[number]] : Options[T & Cmd],
) {
  // console.log(opts)
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
