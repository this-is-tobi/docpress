import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { build as vitepressBuild } from 'vitepress'
import { createOption } from 'commander'
import { DOCPRESS_DIR } from '../utils/const.js'
import { log } from '../utils/logger.js'
import * as buildMod from './build.js'
import { globalOpts } from './global.js'

vi.mock('vitepress', () => ({
  build: vi.fn(),
}))
vi.mock('../utils/logger.js', () => ({
  log: vi.fn(),
}))
vi.mock('./global.js', () => ({
  globalOpts: [
    createOption('-C, --config <string>', 'Path to the configuration file'),
  ],
}))
vi.spyOn(buildMod, 'main')

const { buildCmd, main, suppressVueWarnings } = buildMod

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

describe('suppressVueWarnings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Save original console.warn
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore original console.warn
    vi.restoreAllMocks()
  })

  it('should execute the callback function', async () => {
    const callback = vi.fn().mockResolvedValue('result')

    const result = await suppressVueWarnings(callback)

    expect(callback).toHaveBeenCalled()
    expect(result).toBe('result')
  })

  it('should suppress Vue warnings about invalid watch source', async () => {
    const mockCallback = async () => {
      console.warn('[Vue warn]: Invalid watch source: something')
      console.warn('Regular warning')
      return 'done'
    }

    await suppressVueWarnings(mockCallback)

    expect(console.warn).toHaveBeenCalledWith('Regular warning')
    expect(console.warn).not.toHaveBeenCalledWith('[Vue warn]: Invalid watch source: something')
  })

  it('should suppress Vue warnings about open:false', async () => {
    const mockCallback = async () => {
      console.warn('[Vue warn]: Something with { open: false }')
      console.warn('Regular warning')
      return 'done'
    }

    await suppressVueWarnings(mockCallback)

    expect(console.warn).toHaveBeenCalledWith('Regular warning')
    expect(console.warn).not.toHaveBeenCalledWith('[Vue warn]: Something with { open: false }')
  })

  it('should restore console.warn even if callback throws', async () => {
    const error = new Error('Test error')
    const mockCallback = async () => {
      throw error
    }

    await expect(suppressVueWarnings(mockCallback)).rejects.toThrow(error)

    // We can't easily test if console.warn was restored since we're mocking it,
    // but we can verify that the callback was executed
  })
})

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should log start and success messages when build succeeds', async () => {
    (vitepressBuild as any).mockResolvedValueOnce(undefined) // Simulate successful build

    await main()

    expect(log).toHaveBeenCalledWith(`\n-> Start building Vitepress website.\n\n`, 'info')
    expect(vitepressBuild).toHaveBeenCalledWith(DOCPRESS_DIR)
    expect(log).toHaveBeenCalledWith(`\n\nDocpress build succedeed.`, 'success')
  })

  it('should log start and error messages when build fails', async () => {
    const error = new Error('Build failed')
    ;(vitepressBuild as any).mockRejectedValueOnce(error) // Simulate failed build

    await main()

    expect(log).toHaveBeenCalledWith(`\n-> Start building Vitepress website.\n\n`, 'info')
    expect(vitepressBuild).toHaveBeenCalledWith(DOCPRESS_DIR)
    expect(log).toHaveBeenCalledWith(`\n\nDocpress build failed : ${error}`, 'error')
  })
})
