import { resolve } from 'node:path'
import { program } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { options } from './schemas.js'
import { fetch, parseOptions } from './commands.js'

export const SIDEBAR_PATH = resolve(import.meta.dirname, 'projects/sidebar.json')
export const NAV_PATH = resolve(import.meta.dirname, 'projects/nav.json')
export const INDEX_PATH = resolve(import.meta.dirname, 'projects/index.md')
export const TEMPLATES_PATH = resolve(import.meta.dirname, 'templates')

function main() {
  program
    .name('doc-generator')
    .description('CLI to build a complete portfolio / doc website faster than light.')
    .option(
      '-b, --branch <string>',
      options.shape.branch._def.description,
      options.shape.branch._def.defaultValue(),
    )
    .option(
      '-e, --extra-pages <string>',
      options.shape.extraPages._def.description,
    )
    .option(
      '-p, --provider <string>',
      options.shape.provider._def.description,
      options.shape.provider._def.defaultValue(),
    )
    .option(
      '-r, --repositories <string>',
      options.shape.repositories._def.description,
    )
    .option(
      '-t, --token <string>',
      options.shape.token._def.description,
    )
    .option(
      '-u, --username <string>',
      options.shape.username._def.description,
    )
    .version(`${pkg.version}`)
    .action(opts => fetch(parseOptions(opts)))

  program.parse()
}

main()
