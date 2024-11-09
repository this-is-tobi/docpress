import chalk from 'chalk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { log } from './logger.js'

describe('log function', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'trace').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  const testCases = [
    { type: 'info', level: 30, color: 'white', consoleMethod: 'info' },
    { type: 'warn', level: 20, color: 'yellow', consoleMethod: 'warn' },
    { type: 'error', level: 10, color: 'red', consoleMethod: 'error' },
    { type: 'debug', level: 50, color: 'blue', consoleMethod: 'debug' },
    { type: 'trace', level: 40, color: 'white', consoleMethod: 'trace' },
    { type: 'success', level: 30, color: 'green', consoleMethod: 'info' },
  ] as const

  testCases.forEach(({ type, level, color, consoleMethod }) => {
    it(`should log ${type} message when LOG_LEVEL is ${level} or higher`, () => {
      vi.stubEnv('LOG_LEVEL', level.toString())
      const message = `Test ${type} message`
      const coloredMessage = chalk[color](message)

      log(message, type)

      expect(console[consoleMethod]).toHaveBeenCalledWith(coloredMessage)
    })

    it(`should not log ${type} message when LOG_LEVEL is below ${level}`, () => {
      vi.stubEnv('LOG_LEVEL', (level - 10).toString())
      const message = `Test ${type} message`

      log(message, type)

      expect(console[consoleMethod]).not.toHaveBeenCalled()
    })
  })

  it('should use custom color if provided', () => {
    vi.stubEnv('LOG_LEVEL', '30')
    const message = 'Test custom color message'
    const customColor = 'cyan'
    const coloredMessage = chalk[customColor](message)

    log(message, 'info', customColor)

    expect(console.info).toHaveBeenCalledWith(coloredMessage)
  })

  it('should default to info level if type is not provided', () => {
    vi.stubEnv('LOG_LEVEL', '30')
    const message = 'Test default info message'
    const coloredMessage = chalk.white(message)

    log(message)

    expect(console.info).toHaveBeenCalledWith(coloredMessage)
  })
})
