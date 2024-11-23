import { Command } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { fetchCmd, main as fetchFn, fetchOpts } from './commands/fetch.js'
import { buildCmd, main as buildFn } from './commands/build.js'
import { prepareCmd, main as prepareFn, prepareOpts } from './commands/prepare.js'
import { addOptions, parseOptions } from './utils/commands.js'
import { globalOpts } from './commands/global.js'

// const options = {
//   fetchOpts: [
//     createOption('-b, --branch <string>', configSchema.shape.branch._def.description)
//       .default(configSchema.shape.branch._def.defaultValue()),
//     createOption('-g, --git-provider <string>', configSchema.shape.gitProvider._def.description)
//       .default(configSchema.shape.gitProvider._def.defaultValue()),
//     createOption('-r, --repos-filter <string>', configSchema.shape.reposFilter._def.description),
//   ],
// }

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

export function main() {
  const pm = getProgram()
  pm.parseAsync(process.argv)
}
