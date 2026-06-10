// python-go-test-client.js — manual client for Python/Go framework exceptions.
// Run: node tests/python-go-test-client.js   (HTTP by default; DUMPIO_PROTOCOL=tcp for legacy)

const { sendDump, PROTOCOL } = require('./send')

class SimpleTestClient {
  constructor(host = 'localhost', port = 21234) {
    this.host = host
    this.port = port
  }

  async sendData(data) {
    await sendDump(data, { host: this.host, port: this.port })
    console.log(`✅ Sent ${data.framework} exception (${PROTOCOL})`)
  }

  // Python Django chyba
  async sendDjangoError() {
    await this.sendData({
      type: 'exception',
      framework: 'django',
      exception: 'django.core.exceptions.ObjectDoesNotExist',
      message: 'User matching query does not exist.',
      file: '/app/views.py',
      line: 15,
      traceback: 'File "/app/views.py", line 15, in user_detail\n  user = User.objects.get(pk=999)',
      timestamp: Date.now(),
      flag: 'red'
    })
  }

  // Python Flask chyba
  async sendFlaskError() {
    await this.sendData({
      type: 'exception',
      framework: 'flask',
      exception: 'werkzeug.exceptions.InternalServerError',
      message: 'AttributeError: User object has no attribute username',
      file: '/app/models.py',
      line: 15,
      traceback: 'File "/app/models.py", line 15, in __repr__\n  return f"<User {self.username}>"',
      timestamp: Date.now(),
      flag: 'red'
    })
  }

  // Go panic
  async sendGoPanic() {
    await this.sendData({
      type: 'exception',
      framework: 'go',
      exception: 'runtime error: invalid memory address or nil pointer dereference',
      message: 'panic: runtime error: nil pointer dereference',
      file: '/app/main.go',
      line: 15,
      stack: 'goroutine 1 [running]:\nmain.getUserName(0x0)\n  /app/main.go:15 +0x2c',
      timestamp: Date.now(),
      flag: 'red'
    })
  }

  // Gin framework chyba
  async sendGinError() {
    await this.sendData({
      type: 'exception',
      framework: 'gin',
      exception: 'panic: runtime error: index out of range',
      message: 'panic: index out of range [0] with length 0',
      file: '/app/handlers/users.go',
      line: 25,
      stack: 'main.getUsers(0xc0001a2000)\n  /app/handlers/users.go:25',
      timestamp: Date.now(),
      flag: 'red'
    })
  }

  async sendAll() {
    console.log('🐍 Testing Python frameworks...')
    await this.sendDjangoError()
    await this.sendFlaskError()

    console.log('🐹 Testing Go frameworks...')
    await this.sendGoPanic()
    await this.sendGinError()

    console.log('✨ All tests sent!')
  }
}

// Spuštění testů
new SimpleTestClient().sendAll().catch(console.error)
