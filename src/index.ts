import { program } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { fetchCmd, main as fetchFn, fetchOpts } from './commands/fetch.js'
import { buildCmd, main as buildFn } from './commands/build.js'
import { prepareCmd, main as prepareFn, prepareOpts } from './commands/prepare.js'
import { addOptions } from './utils/commands.js'
import { globalOpts } from './commands/global.js'

export default function main() {
  const pm = program
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

  pm.parseAsync()
}
