import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Command } from 'commander'
import pkg from '../package.json' with { type: 'json' }
import { main as fetchFn, fetchOpts } from './commands/fetch.js'
import { main as buildFn } from './commands/build.js'
import { main as prepareFn, prepareOpts } from './commands/prepare.js'
import { addOptions } from './utils/commands.js'
import { globalOpts } from './commands/global.js'
import main, { getProgram } from './index.js'

vi.mock('./commands/fetch.js', () => ({
  fetchCmd: new Command('fetch'),
  main: vi.fn(),
  fetchOpts: [],
}))

vi.mock('./commands/build.js', () => ({
  buildCmd: new Command('build'),
  main: vi.fn(),
}))

vi.mock('./commands/prepare.js', () => ({
  prepareCmd: new Command('prepare'),
  main: vi.fn(),
  prepareOpts: [],
}))

vi.mock('./utils/commands.js', () => ({
  addOptions: vi.fn(),
}))

describe('getProgram', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should configure the program with the correct name, description, and version', () => {
    const pm = getProgram()

    expect(pm.name()).toBe('docpress')
    expect(pm.description()).toBe('Build your doc website faster than light ⚡️⚡️⚡️')
    expect(pm.version()).toBe(pkg.version)
  })

  it('should add fetch, prepare, and build commands to the program', () => {
    const pm = getProgram()

    const commands = pm.commands.map(cmd => cmd.name())
    expect(commands).toContain('fetch')
    expect(commands).toContain('prepare')
    expect(commands).toContain('build')
  })

  it('should add global, fetch, and prepare options via addOptions', () => {
    getProgram()
    expect(addOptions).toHaveBeenCalledWith(expect.any(Command), [...fetchOpts, ...prepareOpts, ...globalOpts])
  })

  it('should sort subcommands, options, and show global options in help', () => {
    const pm = getProgram()

    const helpConfig = pm.configureHelp()
    expect(helpConfig.sortSubcommands).toBe(true)
    expect(helpConfig.sortOptions).toBe(true)
    expect(helpConfig.showGlobalOptions).toBe(true)
  })

  it('should pass through options and enable positional options', () => {
    const pm = getProgram()

    expect((pm as any)._passThroughOptions).toBe(true)
    expect((pm as any)._enablePositionalOptions).toBe(true)
    expect((pm as any)._helpConfiguration).toMatchObject({
      sortSubcommands: true,
      sortOptions: true,
      showGlobalOptions: true,
    })
  })

  it('should call fetchFn, prepareFn, and buildFn in default action', async () => {
    const pm = getProgram()

    await pm.parseAsync(['node', 'main'])

    expect(fetchFn).toHaveBeenCalled()
    expect(prepareFn).toHaveBeenCalled()
    expect(buildFn).toHaveBeenCalled()
  })
})

describe('main', () => {
  it('should parse arguments when main is called', () => {
    const parseAsyncSpy = vi.spyOn(Command.prototype, 'parseAsync')
    main()
    expect(parseAsyncSpy).toHaveBeenCalled()
    parseAsyncSpy.mockRestore()
  })
})
