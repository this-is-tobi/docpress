import { program } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { options as fetchOpts } from './fetch/schemas.js'
import { getCommand as getFetchCommand } from './fetch/command.js'
import { getCommand as getBuildCommand } from './build/command.js'

function main() {
  program
    .name('docpress')
    .description('Build portfolio / doc website faster than light ⚡️')
    .version(`${pkg.version}`)
    .option(
      '-c, --config <string>',
      fetchOpts.shape.config._def.description,
    )

  getFetchCommand(program)
  getBuildCommand(program)

  program.parse()
}

main()
