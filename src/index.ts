import { program } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { fetch, fetchCmd, fetchOpts } from './commands/fetch.js'
import { prepare, prepareCmd, prepareOpts } from './commands/prepare.js'
import { build, buildCmd } from './commands/build.js'
import { addOptions } from './utils/commands.js'

export default function main() {
  const pm = program
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
    })

  addOptions(pm, [...fetchOpts, ...prepareOpts])

  pm.parseAsync()
}
