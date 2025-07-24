import { Command } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { fetchCmd, main as fetchFn, fetchOpts } from './commands/fetch.js'
import { buildCmd, main as buildFn } from './commands/build.js'
import { prepareCmd, main as prepareFn, prepareOpts } from './commands/prepare.js'
import { addOptions, parseOptions } from './utils/commands.js'
import { globalOpts } from './commands/global.js'

/**
 * Creates and configures the Command Line Interface for DocPress
 *
 * @returns A configured Commander program instance
 */
export function getProgram() {
  const pm = new Command()
    .name('docpress')
    .description('Build your doc website faster than light ⚡️⚡️⚡️')
    .version(`${pkg.version}`)
    .action(async (opts, _cmd) => {
      const parsedOpts = parseOptions('global', opts)
      await fetchFn(parsedOpts)
      await prepareFn(parsedOpts)
      await buildFn()
    })
    .configureHelp({
      sortSubcommands: true,
      sortOptions: true,
      showGlobalOptions: true,
    })
    .enablePositionalOptions()
    .passThroughOptions()
    .addCommand(fetchCmd)
    .addCommand(prepareCmd)
    .addCommand(buildCmd)

  addOptions(pm, [...fetchOpts, ...prepareOpts, ...globalOpts])

  return pm
}

/**
 * Entry point for the DocPress CLI
 * Initializes and runs the command parser
 */
export function main() {
  const pm = getProgram()
  pm.parseAsync(process.argv)
}
