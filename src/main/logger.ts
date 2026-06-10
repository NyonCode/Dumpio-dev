import { is } from '@electron-toolkit/utils'

/**
 * Minimal logger gated by dev mode.
 *
 * `info`/`debug` are silenced in production builds to keep the packaged app
 * quiet; warnings and errors are always emitted.
 */
export const logger = {
  info: (...args: unknown[]): void => {
    if (is.dev) console.log(...args)
  },
  debug: (...args: unknown[]): void => {
    if (is.dev) console.debug(...args)
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args)
  },
  error: (...args: unknown[]): void => {
    console.error(...args)
  }
}
