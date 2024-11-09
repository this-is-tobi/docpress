/* eslint-disable dot-notation */
import type { ColorName } from 'chalk'
import chalk from 'chalk'

type LogType = keyof Pick<Console, 'info' | 'warn' | 'error' | 'debug' | 'trace'> | 'success'

type ColorMap = {
  [K in LogType]: {
    color: ColorName
    level: number
  }
}

function getLogLevel() {
  return typeof Number(process.env['LOG_LEVEL']) === 'number' && !Number.isNaN(Number(process.env['LOG_LEVEL']))
    ? Number(process.env['LOG_LEVEL'])
    : 30
}

const colorMap: ColorMap = {
  info: { color: 'white', level: 30 },
  warn: { color: 'yellow', level: 20 },
  error: { color: 'red', level: 10 },
  debug: { color: 'blue', level: 50 },
  trace: { color: 'white', level: 40 },
  success: { color: 'green', level: 30 },
}

export function log(msg: string, type: LogType = 'info', color?: ColorName) {
  const computedMsg = color ? chalk[color](msg) : chalk[colorMap[type].color](msg)
  const computedType = type === 'success' ? 'info' : type

  if (getLogLevel() >= colorMap[type].level) {
    console[computedType](computedMsg)
  }
}
