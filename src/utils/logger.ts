/* eslint-disable dot-notation */
import pc from 'picocolors'

/**
 * Log message types
 */
type LogType = keyof Pick<Console, 'info' | 'warn' | 'error' | 'debug' | 'trace'> | 'success'

/**
 * Colors supported by the logger
 */
type Color = 'red' | 'yellow' | 'white' | 'green' | 'blue'

/**
 * Maps a supported color to its picocolors formatter
 */
const colorFns: Record<Color, (input: string) => string> = {
  red: pc.red,
  yellow: pc.yellow,
  white: pc.white,
  green: pc.green,
  blue: pc.blue,
}

/**
 * Mapping of log types to colors and levels
 */
type ColorMap = {
  [K in LogType]: {
    color: Color
    level: number
  }
}

/**
 * Gets the current log level from environment variables
 *
 * @returns Log level number (default: 30)
 */
function getLogLevel() {
  const level = Number(process.env['LOG_LEVEL'])
  return Number.isNaN(level) ? 30 : level
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
export function log(msg: string, type: LogType = 'info', color?: Color) {
  const computedMsg = color ? colorFns[color](msg) : colorFns[colorMap[type].color](msg)
  const computedType = type === 'success' ? 'info' : type

  if (getLogLevel() >= colorMap[type].level) {
    console[computedType](computedMsg)
  }
}
