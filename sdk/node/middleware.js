'use strict'

// Framework integrations for dumpio-client.
//
// All exports here are *defensive*: they must never break the host application.
// If anything throws while building or emitting a dump, the request continues
// untouched. Integrations no-op silently when the viewer is down (the underlying
// transport is fire-and-forget) and respect `configure()` / `DUMPIO_DISABLE`.
//
//   const { expressMiddleware, installGlobalErrorHandlers } = require('dumpio-client/middleware')
//   app.use(expressMiddleware())
//   installGlobalErrorHandlers()

const { dumpioHttp, dumpioException } = require('./index')

/**
 * @typedef {object} HttpMiddlewareOptions
 * @property {string} [channel] Channel to tag emitted `http` dumps with.
 * @property {boolean} [headers] Include request/response headers (default false — they can be noisy/sensitive).
 * @property {(req: unknown) => boolean} [skip] Return true to skip a request (e.g. health checks).
 */

/** Read milliseconds since a `process.hrtime.bigint()` start, safely. */
function elapsedMs(startNs) {
  try {
    return Number(process.hrtime.bigint() - startNs) / 1e6
  } catch {
    return undefined
  }
}

/** Swallow any error so the host app is never affected. */
function safe(fn) {
  try {
    fn()
  } catch {
    // never let the SDK break the host
  }
}

/**
 * Express / Connect request-logging middleware. Times each request and emits an
 * `http` dump when the response finishes.
 *
 * @param {HttpMiddlewareOptions} [options]
 * @returns {(req: any, res: any, next: () => void) => void}
 *
 * @example
 *   app.use(expressMiddleware({ channel: 'http' }))
 */
function expressMiddleware(options) {
  const opts = options || {}
  return function dumpioExpress(req, res, next) {
    let start
    safe(() => {
      if (opts.skip && opts.skip(req)) return
      start = process.hrtime.bigint()
      res.on('finish', () => {
        safe(() => {
          dumpioHttp(
            {
              method: req.method,
              url: req.originalUrl || req.url,
              status: res.statusCode,
              headers: opts.headers ? req.headers : undefined,
              responseTime: elapsedMs(start)
            },
            { channel: opts.channel }
          )
        })
      })
    })
    next()
  }
}

/**
 * Koa middleware. Times each request and emits an `http` dump after the
 * downstream chain resolves.
 *
 * @param {HttpMiddlewareOptions} [options]
 * @returns {(ctx: any, next: () => Promise<void>) => Promise<void>}
 *
 * @example
 *   app.use(koaMiddleware())
 */
function koaMiddleware(options) {
  const opts = options || {}
  return async function dumpioKoa(ctx, next) {
    let start
    let skip = false
    safe(() => {
      if (opts.skip && opts.skip(ctx.request)) skip = true
      start = process.hrtime.bigint()
    })
    try {
      await next()
    } finally {
      if (!skip) {
        safe(() => {
          dumpioHttp(
            {
              method: ctx.method,
              url: ctx.originalUrl || ctx.url,
              status: ctx.status,
              headers: opts.headers ? ctx.headers : undefined,
              responseTime: elapsedMs(start)
            },
            { channel: opts.channel }
          )
        })
      }
    }
  }
}

/**
 * Fastify plugin. Registers an `onResponse` hook that emits an `http` dump for
 * each request. Compatible with Fastify's `fastify-plugin`-less registration
 * (`fastify.register(fastifyPlugin, opts)`).
 *
 * @param {any} fastify The Fastify instance.
 * @param {HttpMiddlewareOptions} [options]
 * @param {(err?: Error) => void} [done]
 *
 * @example
 *   fastify.register(fastifyPlugin)
 */
function fastifyPlugin(fastify, options, done) {
  const opts = options || {}
  safe(() => {
    fastify.addHook('onResponse', (request, reply, next) => {
      safe(() => {
        if (!(opts.skip && opts.skip(request))) {
          // Fastify exposes the elapsed time in ms via reply.elapsedTime / getResponseTime().
          let responseTime
          try {
            responseTime =
              typeof reply.elapsedTime === 'number'
                ? reply.elapsedTime
                : typeof reply.getResponseTime === 'function'
                  ? reply.getResponseTime()
                  : undefined
          } catch {
            responseTime = undefined
          }
          dumpioHttp(
            {
              method: request.method,
              url: request.url,
              status: reply.statusCode,
              headers: opts.headers ? request.headers : undefined,
              responseTime
            },
            { channel: opts.channel }
          )
        }
      })
      // Support both callback- and promise-style hooks.
      if (typeof next === 'function') next()
    })
  })
  if (typeof done === 'function') done()
}

/**
 * Hook `uncaughtException` and `unhandledRejection` so unhandled errors are sent
 * to the viewer as `exception` dumps. Does not swallow or alter the errors —
 * existing handlers still run and the default process behaviour is preserved.
 *
 * @param {{ channel?: string }} [options]
 * @returns {() => void} A function that removes the installed listeners.
 *
 * @example
 *   installGlobalErrorHandlers({ channel: 'errors' })
 */
function installGlobalErrorHandlers(options) {
  const opts = options || {}

  const onException = (error) => {
    safe(() => dumpioException(error instanceof Error ? error : new Error(String(error)), undefined, { channel: opts.channel }))
  }
  const onRejection = (reason) => {
    safe(() => dumpioException(reason instanceof Error ? reason : new Error(String(reason)), { unhandledRejection: true }, { channel: opts.channel }))
  }

  process.on('uncaughtException', onException)
  process.on('unhandledRejection', onRejection)

  return function uninstall() {
    safe(() => {
      process.removeListener('uncaughtException', onException)
      process.removeListener('unhandledRejection', onRejection)
    })
  }
}

module.exports = {
  expressMiddleware,
  koaMiddleware,
  fastifyPlugin,
  installGlobalErrorHandlers
}
