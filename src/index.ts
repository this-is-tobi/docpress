import { program } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { main as fetch, cmd as fetchCmd, opts as fetchOpts } from './fetch/command.js'
import { main as prepare, cmd as prepareCmd, opts as prepareOpts } from './prepare/command.js'
import { main as build, cmd as buildCmd } from './build/command.js'
import { addOptions } from './utils/commands.js'

function main() {
  const pm = addOptions(program
    .name('docpress')
    .description('Build your doc website faster than light ⚡️')
    .version(`${pkg.version}`)
    .addCommand(fetchCmd)
    .addCommand(prepareCmd)
    .addCommand(buildCmd)
    .action(async (opts, _cmd) => {
      await fetch(opts)
      await prepare(opts)
      await build()
    }), [...fetchOpts, ...prepareOpts])

  pm.parseAsync()
}

main()
