// Vytvořte nový soubor: test-context.js

const net = require('net')

class ContextTestClient {
  constructor(host = 'localhost', port = 21234) {
    this.host = host
    this.port = port
  }

  sendData(data) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket()
      client.connect(this.port, this.host, () => {
        client.write(JSON.stringify(data) + '\n')
        console.log(`✅ Sent ${data.framework} with context`)
        client.end()
        resolve()
      })
      client.on('error', reject)
    })
  }

  // Test Python Django s kompletním kontextem
  async testPythonContext() {
    await this.sendData({
      type: 'exception',
      framework: 'django',
      exception: 'django.core.exceptions.ObjectDoesNotExist',
      message: 'User matching query does not exist.',
      file: '/app/views.py',
      line: 15,

      // REQUEST CONTEXT
      request: {
        url: '/users/999/',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'text/html,application/xhtml+xml'
        },
        ip: '192.168.1.100'
      },

      // USER CONTEXT
      user: {
        id: 1,
        email: 'admin@example.com',
        name: 'Admin User',
        roles: ['admin', 'staff']
      },

      // PYTHON SPECIFICKÉ
      python_version: '3.11.0',
      framework_version: '4.2.0',
      environment: 'production',

      // DJANGO SPECIFICKÉ
      context: {
        view: 'myapp.views.user_detail',
        middleware: ['django.middleware.security.SecurityMiddleware']
      },

      // LOCALS (Python proměnné)
      locals: {
        user_id: 999,
        request_user: 'admin@example.com',
        debug_mode: false
      },

      // DATABASE
      database: {
        query: 'SELECT * FROM auth_user WHERE id = 999',
        time: 2.3,
        connection: 'default'
      },

      timestamp: Date.now(),
      flag: 'red'
    })
  }

  // Test Go Gin s kontextem
  async testGoContext() {
    await this.sendData({
      type: 'exception',
      framework: 'gin',
      exception: 'panic: runtime error: nil pointer dereference',
      message: 'panic: runtime error: nil pointer dereference',
      file: '/app/handlers/users.go',
      line: 25,

      // REQUEST CONTEXT
      request: {
        url: '/api/users',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token123'
        },
        body: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        ip: '10.0.0.1'
      },

      // GO SPECIFICKÉ
      go_version: '1.21.0',
      framework_version: '1.9.1',
      goos: 'linux',
      goarch: 'amd64',
      environment: 'production',

      // GOROUTINE INFO
      goroutine: {
        id: 19,
        state: 'running'
      },

      // GO VARIABLES
      variables: {
        'user': 'nil (*User)',
        'db': '*gorm.DB',
        'ctx': 'gin.Context'
      },

      timestamp: Date.now(),
      flag: 'red'
    })
  }

  // Test FastAPI s Pydantic kontextem
  async testFastAPIContext() {
    await this.sendData({
      type: 'exception',
      framework: 'fastapi',
      exception: 'pydantic.error_wrappers.ValidationError',
      message: '2 validation errors for User',
      file: '/app/models.py',
      line: 8,

      // REQUEST
      request: {
        url: '/users/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          name: 'John',
          age: -5  // invalid
        }
      },

      // FASTAPI SPECIFICKÉ
      python_version: '3.11.0',
      framework_version: '0.104.0',
      path_params: {},
      query_params: {
        'include_inactive': 'false'
      },

      timestamp: Date.now(),
      flag: 'yellow'
    })
  }

  async runAllTests() {
    console.log('🧪 Testing Context Parsing...\n')

    console.log('🐍 Testing Python Django context...')
    await this.testPythonContext()
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('🐹 Testing Go Gin context...')
    await this.testGoContext()
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('⚡ Testing FastAPI context...')
    await this.testFastAPIContext()

    console.log('\n✨ All context tests sent!')
    console.log('👀 Check your DumpeX app - měli byste vidět bohatý context v každé chybě!')
  }
}

// Spuštění testů
new ContextTestClient().runAllTests().catch(console.error)
