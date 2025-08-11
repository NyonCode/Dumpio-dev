import { createServer, Server, Socket } from 'net'
import { EventEmitter } from 'events'

export class TCPServer extends EventEmitter {
  private server: Server | null = null
  private host: string
  private port: number
  private isRunning = false
  private isShuttingDown = false
  private connectionBuffers = new Map<string, string>()

  constructor(host: string, port: number) {
    super()
    this.host = host
    this.port = port
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running')
    }

    if (this.isShuttingDown) {
      throw new Error('Server is shutting down')
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((socket: Socket) => {
        this.handleConnection(socket)
      })

      this.server.on('error', (error: any) => {
        console.error(`TCP Server error on ${this.host}:${this.port}:`, error)
        if (error.code === 'EADDRINUSE') {
          const errorMsg = `Port ${this.port} is already in use on ${this.host}`
          this.emit('error', new Error(errorMsg))
          reject(new Error(errorMsg))
        } else if (error.code === 'EADDRNOTAVAIL') {
          const errorMsg = `Address ${this.host} is not available`
          this.emit('error', new Error(errorMsg))
          reject(new Error(errorMsg))
        } else {
          this.emit('error', error)
          reject(error)
        }
      })

      // For localhost, try IPv4 first
      const actualHost = this.host === 'localhost' ? '127.0.0.1' : this.host

      console.log(`Starting TCP server on ${actualHost}:${this.port}`)

      this.server.listen(this.port, actualHost, () => {
        this.isRunning = true
        console.log(`✅ TCP Server successfully started on ${actualHost}:${this.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return
    }

    this.isShuttingDown = true

    return new Promise((resolve) => {
      // Close all connections first
      this.server!.getConnections((_err, count) => {
        if (count > 0) {
          console.log(`Closing ${count} active connections on ${this.host}:${this.port}`)
        }
      })

      this.server!.close(() => {
        this.isRunning = false
        this.isShuttingDown = false
        this.server = null
        this.connectionBuffers.clear()
        console.log(`TCP Server stopped on ${this.host}:${this.port}`)
        resolve()
      })
    })
  }

  private handleConnection(socket: Socket): void {
    const connectionId = `${socket.remoteAddress}:${socket.remotePort}`
    console.log(`New connection from ${connectionId}`)

    // Initialize buffer for this connection
    this.connectionBuffers.set(connectionId, '')

    socket.on('data', (data) => {
      try {
        // Get existing buffer for this connection
        let buffer = this.connectionBuffers.get(connectionId) || ''
        buffer += data.toString()

        // Try to extract complete JSON objects
        const messages = this.extractCompleteMessages(buffer)

        // Process each complete message
        messages.complete.forEach((message) => {
          this.processMessage(message, connectionId)
        })

        // Store remaining incomplete buffer
        this.connectionBuffers.set(connectionId, messages.remaining)
      } catch (error) {
        console.error('Error handling data:', error)
        this.emit('error', error)
      }
    })

    socket.on('error', (error) => {
      console.error(`Socket error from ${connectionId}:`, error)
      this.connectionBuffers.delete(connectionId)
    })

    socket.on('close', () => {
      console.log(`Connection closed: ${connectionId}`)
      this.connectionBuffers.delete(connectionId)
    })

    // Send welcome message
    socket.write(
      JSON.stringify({
        type: 'welcome',
        message: 'Connected to TCP Dump Viewer',
        timestamp: Date.now()
      }) + '\n'
    )
  }

  private extractCompleteMessages(buffer: string): { complete: string[]; remaining: string } {
    const complete: string[] = []
    let remaining = buffer
    let braceCount = 0
    let inString = false
    let escaped = false
    let messageStart = 0

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i]

      // Handle string detection (ignore braces inside strings)
      if (char === '"' && !escaped) {
        inString = !inString
      }

      // Handle escape sequences
      escaped = char === '\\' && !escaped

      if (!inString) {
        if (char === '{') {
          if (braceCount === 0) {
            messageStart = i
          }
          braceCount++
        } else if (char === '}') {
          braceCount--

          // Complete JSON object found
          if (braceCount === 0) {
            const message = buffer.substring(messageStart, i + 1).trim()
            if (message) {
              complete.push(message)
            }
            messageStart = i + 1
          }
        }
      }
    }

    // Handle single-line JSON (fallback for non-pretty printed JSON)
    if (complete.length === 0 && braceCount === 0) {
      const lines = buffer.split('\n')
      remaining = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
          try {
            JSON.parse(trimmed) // Validate it's valid JSON
            complete.push(trimmed)
          } catch {
            // If it's not valid JSON, might be part of multi-line
            remaining = trimmed + '\n' + remaining
          }
        }
      }
    } else {
      // For multi-line JSON, keep everything after the last complete message
      remaining = buffer.substring(messageStart).trim()
    }

    return { complete, remaining }
  }

  private processMessage(message: string, connectionId: string): void {
    try {
      const parsed = JSON.parse(message)

      // Add connection info
      parsed.origin = parsed.origin || connectionId
      parsed.timestamp = parsed.timestamp || Date.now()

      console.log(`📦 Received dump from ${connectionId}:`, {
        type: parsed.type || 'unknown',
        message: parsed.message || 'no message',
        size: `${message.length} chars`
      })

      this.emit('dump', parsed)
    } catch (parseError) {
      console.error('Failed to parse JSON from', connectionId, ':', parseError)
      console.error('Problematic message:', message.substring(0, 200) + '...')

      // Emit as raw data dump
      this.emit('dump', {
        type: 'raw',
        data: message,
        origin: connectionId,
        timestamp: Date.now(),
        flag: 'red',
        error: 'JSON parse failed'
      })
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      host: this.host,
      port: this.port,
      isShuttingDown: this.isShuttingDown,
      activeConnections: this.connectionBuffers.size
    }
  }
}
