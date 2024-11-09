import type { Command, Option } from 'commander'
import { fromError } from 'zod-validation-error'
import type { GlobalOpts } from '../schemas/global.js'
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

type MergeOptions<T extends Cmd[]> = (T extends [infer First, ...infer Rest]
  ? First extends Cmd
    ? Rest extends Cmd[]
      ? Options[First] & MergeOptions<Rest>
      : Options[First]
    : never
  : unknown)

export function parseOptions<T extends Cmd[]>(cmds: [...T], opts: MergeOptions<T>): MergeOptions<T> {
  log(`Initializing Docpress...`, 'info', 'blue')
  log(`\n\n-> Checking for required environment settings and configurations.`, 'info')

  function parseSingleOption<K extends Cmd>(cmd: K, singleOpts: Options[K]): Options[K] {
    const res = options[cmd].safeParse({
      ...globalOptsSchema.parse(singleOpts).config,
      ...singleOpts,
    })
    if (res.success) {
      return res.data as Options[K]
    }
    log(`   An error occurred while checking configuration: ${fromError(res.error).toString()}`, 'error')
    process.exit(0)
  }

  const mergedResult = cmds.reduce((acc, singleCmd) => {
    const singleResult = parseSingleOption(singleCmd, opts as Options[typeof singleCmd])
    return Object.assign(acc, singleResult)
  }, {})

  log('   Setup complete! Ready to process your documentation.', 'info')
  return mergedResult as MergeOptions<T>
}

// export function parseOptions<T extends Cmd | Cmd[]>(cmds: T, opts: T extends Cmd[] ? MergeOptions<T> : Options[T]): T extends Cmd[] ? MergeOptions<T> : Options[T] {
//   log(`Initializing Docpress...`, 'info', 'blue')
//   log(`\n\n-> Checking for required environment settings and configurations.`, 'info')

//   function parseSingleOption<K extends Cmd>(cmd: K, singleOpts: Options[K]): Options[K] {
//     const res = options[cmd].safeParse({
//       ...globalOptsSchema.parse(singleOpts).config,
//       ...singleOpts,
//     })
//     if (res.success) {
//       return res.data as Options[K]
//     }
//     log(`   An error occurred while checking configuration: ${fromError(res.error).toString()}`, 'error')
//     process.exit(0)
//   }

//   const cmdArray = Array.isArray(cmds) ? cmds : [cmds]
//   const mergedResult = cmdArray.reduce((acc, singleCmd) => {
//     const singleResult = parseSingleOption(singleCmd, opts as Options[typeof singleCmd])
//     return Object.assign(acc, singleResult)
//   }, {})

//   log('   Setup complete! Ready to process your documentation.', 'info')
//   return mergedResult as T extends Cmd[] ? MergeOptions<T> : Options[T]
// }

export function addOptions(cmd: Command, opts: Option[]) {
  opts.forEach(opt => cmd.addOption(opt))
  return cmd
}
