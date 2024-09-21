import { resolve } from 'node:path'
import { program } from 'commander'
import { version } from '../package.json'
import { options } from './schemas.ts'
import { fetch, parseOptions } from './commands.ts'

export const SIDEBAR_PATH = resolve(__dirname, 'projects/sidebar.json')
export const NAV_PATH = resolve(__dirname, 'projects/nav.json')
export const INDEX_PATH = resolve(__dirname, 'projects/index.md')
export const TEMPLATES_PATH = resolve(__dirname, 'templates')

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
      '-h, --header-pages <string>',
      options.shape.headerPages._def.description,
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
    .version(`${version}`)
    .action(opts => fetch(parseOptions(opts)))

  program.parse()
}

main()
