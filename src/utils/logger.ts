/* eslint-disable dot-notation */
import type { ColorName } from 'chalk'
import chalk from 'chalk'

/**
 * Log message types
 */
type LogType = keyof Pick<Console, 'info' | 'warn' | 'error' | 'debug' | 'trace'> | 'success'

/**
 * Mapping of log types to colors and levels
 */
type ColorMap = {
  [K in LogType]: {
    color: ColorName
    level: number
  }
}

/**
 * Gets the current log level from environment variables
 *
 * @returns Log level number (default: 30)
 */
function getLogLevel() {
  return typeof Number(process.env['LOG_LEVEL']) === 'number' && !Number.isNaN(Number(process.env['LOG_LEVEL']))
    ? Number(process.env['LOG_LEVEL'])
    : 30
}

/**
 * Color mapping configuration for different log types
 */
const colorMap: ColorMap = {
  error: { color: 'red', level: 10 },
  warn: { color: 'yellow', level: 20 },
  info: { color: 'white', level: 30 },
  success: { color: 'green', level: 30 },
  trace: { color: 'white', level: 40 },
  debug: { color: 'blue', level: 50 },
}

/**
 * Logs a message with color formatting based on type and level
 *
 * @param msg - Message to log
 * @param type - Type of log message (info, warn, error, debug, trace, success)
 * @param color - Optional specific color to use instead of the default for the type
 */
export function log(msg: string, type: LogType = 'info', color?: ColorName) {
  const computedMsg = color ? chalk[color](msg) : chalk[colorMap[type].color](msg)
  const computedType = type === 'success' ? 'info' : type

  if (getLogLevel() >= colorMap[type].level) {
    console[computedType](computedMsg)
  }
}
