import { describe, expect, it, vi } from 'vitest'
import { build as vitepressBuild } from 'vitepress'
import { createOption } from 'commander'
import { DOCPRESS_DIR } from '../utils/const.js'
import * as buildMod from './build.js'
import { globalOpts } from './global.js'

vi.mock('vitepress', () => ({
  build: vi.fn(),
}))
vi.mock('./global.js', () => ({
  globalOpts: [
    createOption('-C, --config <string>', 'Path to the configuration file'),
  ],
}))
vi.spyOn(buildMod, 'main')

const { buildCmd, main } = buildMod

describe('buildCmd', () => {
  it('should have the correct command name', () => {
    expect(buildCmd.name()).toBe('build')
  })

  it('should include global options', () => {
    const { options } = buildCmd
    expect(options).toEqual(expect.arrayContaining(globalOpts))
  })

  it('should have the correct description', () => {
    expect(buildCmd.description()).toBe('Build vitepress website.')
  })

  it('should call main function when action is triggered', async () => {
    buildCmd.action(main)
    buildCmd.parseAsync()
    expect(main).toHaveBeenCalled()
  })
})

describe('main', () => {
  it('should call vitepressBuild with DOCPRESS_DIR', async () => {
    await main()
    expect(vitepressBuild).toHaveBeenCalledWith(DOCPRESS_DIR)
  })
})
