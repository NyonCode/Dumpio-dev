import { createServer, Server, Socket } from 'net'
import { EventEmitter } from 'events'

export class TCPServer extends EventEmitter {
  private server: Server | null = null
  private host: string
  private port: number
  private isRunning = false

  constructor(host: string, port: number) {
    super()
    this.host = host
    this.port = port
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running')
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((socket: Socket) => {
        this.handleConnection(socket)
      })

      this.server.on('error', (error) => {
        this.emit('error', error)
        reject(error)
      })

      this.server.listen(this.port, this.host, () => {
        this.isRunning = true
        console.log(`TCP Server listening on ${this.host}:${this.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false
        this.server = null
        resolve()
      })
    })
  }

  private handleConnection(socket: Socket): void {
    console.log(`New connection from ${socket.remoteAddress}:${socket.remotePort}`)

    let buffer = ''

    socket.on('data', (data) => {
      try {
        buffer += data.toString()

        // Handle multiple JSON objects in one packet
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line.trim())

              // Add connection info
              parsed.origin = parsed.origin || `${socket.remoteAddress}:${socket.remotePort}`
              parsed.timestamp = parsed.timestamp || Date.now()

              this.emit('dump', parsed)
            } catch (parseError) {
              console.error('Failed to parse JSON:', parseError)
              // Emit as raw data dump
              this.emit('dump', {
                type: 'raw',
                data: line.trim(),
                origin: `${socket.remoteAddress}:${socket.remotePort}`,
                timestamp: Date.now(),
                flag: 'red'
              })
            }
          }
        }
      } catch (error) {
        console.error('Error handling data:', error)
        this.emit('error', error)
      }
    })

    socket.on('error', (error) => {
      console.error(`Socket error from ${socket.remoteAddress}:${socket.remotePort}:`, error)
    })

    socket.on('close', () => {
      console.log(`Connection closed: ${socket.remoteAddress}:${socket.remotePort}`)
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

  getStatus() {
    return {
      isRunning: this.isRunning,
      host: this.host,
      port: this.port
    }
  }
}
