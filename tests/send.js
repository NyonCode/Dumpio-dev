// Shared sender for Dumpio's manual test clients.
//
// Defaults to the HTTP-first ingest (POST /dumps). Switch to the legacy TCP
// transport with DUMPIO_PROTOCOL=tcp. Override target/auth via env:
//   DUMPIO_HOST (default 127.0.0.1), DUMPIO_PORT (default 21234), DUMPIO_TOKEN.

const net = require('net')
const http = require('http')

const PROTOCOL = (process.env.DUMPIO_PROTOCOL || 'http').toLowerCase()
const TOKEN = process.env.DUMPIO_TOKEN || ''

function sendHttp(payload, host, port) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload))
    const headers = { 'Content-Type': 'application/json', 'Content-Length': body.length }
    if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`

    const req = http.request({ host, port, path: '/dumps', method: 'POST', headers }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve()
        else reject(new Error(`HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString()}`))
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function sendTcp(payload, host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => {
      const data = TOKEN ? { ...payload, token: TOKEN } : payload
      socket.write(JSON.stringify(data) + '\n', () => {
        socket.end()
        resolve()
      })
    })
    socket.on('error', reject)
  })
}

function sendDump(payload, opts = {}) {
  // Env wins over per-call defaults so the same client can be retargeted.
  const host = process.env.DUMPIO_HOST || opts.host || '127.0.0.1'
  const port = process.env.DUMPIO_PORT ? parseInt(process.env.DUMPIO_PORT, 10) : opts.port || 21234
  return PROTOCOL === 'tcp' ? sendTcp(payload, host, port) : sendHttp(payload, host, port)
}

module.exports = { sendDump, PROTOCOL }
