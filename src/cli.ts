import { Command } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { fetchCmd, main as fetchFn, fetchOpts } from './commands/fetch.js'
import { buildCmd, main as buildFn } from './commands/build.js'
import { prepareCmd, main as prepareFn, prepareOpts } from './commands/prepare.js'
import { addOptions } from './utils/commands.js'
import { globalOpts } from './commands/global.js'

export function getProgram() {
  const pm = new Command()
    .name('docpress')
    .description('Build your doc website faster than light ⚡️⚡️⚡️')
    .version(`${pkg.version}`)
    .addCommand((fetchCmd))
    .addCommand(prepareCmd)
    .addCommand(buildCmd)
    .action(async (opts, _cmd) => {
      await fetchFn(opts)
      await prepareFn(opts)
      await buildFn()
    })
    .configureHelp({
      sortSubcommands: true,
      sortOptions: true,
      showGlobalOptions: true,
    })
    .enablePositionalOptions()
    .passThroughOptions()

  addOptions(pm, [...fetchOpts, ...prepareOpts, ...globalOpts])

  return pm
}

export function main() {
  const pm = getProgram()
  pm.parseAsync()
}
