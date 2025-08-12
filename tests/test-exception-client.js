// test-exception-client.js
// Run this file with: node test-exception-client.js

const net = require('net')

class ExceptionTestClient {
  constructor(host = 'localhost', port = 21234) {
    this.host = host
    this.port = port
  }

  sendData(data) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket()

      client.connect(this.port, this.host, () => {
        const message = JSON.stringify(data) + '\n'
        client.write(message)
        console.log(`✅ Sent ${data.framework || 'unknown'} exception to ${this.host}:${this.port}`)
        client.end()
        resolve()
      })

      client.on('error', (err) => {
        console.error(`❌ Failed to connect: ${err.message}`)
        reject(err)
      })

      client.on('close', () => {
        resolve()
      })
    })
  }

  // Laravel Exception
  async sendLaravelException() {
    const data = {
      type: 'exception',
      framework: 'laravel',
      exception: 'Illuminate\\Database\\QueryException',
      message:
        "SQLSTATE[42S02]: Base table or view not found: 1146 Table 'database.users' doesn't exist (SQL: select * from `users` where `email` = admin@example.com limit 1)",
      file: '/app/vendor/laravel/framework/src/Illuminate/Database/Connection.php',
      line: 712,
      code: '42S02',
      sql: 'select * from `users` where `email` = ? limit 1',
      bindings: ['admin@example.com'],
      trace: [
        {
          file: '/app/app/Http/Controllers/Auth/LoginController.php',
          line: 45,
          function: 'attempt',
          class: 'App\\Http\\Controllers\\Auth\\LoginController',
          type: '->',
          code_snippet: [
            '    protected function attemptLogin(Request $request)',
            '    {',
            "        $user = User::where('email', $request->email)->first(); // Error here",
            '        ',
            '        if (!$user || !Hash::check($request->password, $user->password)) {',
            '            return false;',
            '        }'
          ]
        },
        {
          file: '/app/vendor/laravel/framework/src/Illuminate/Foundation/Auth/AuthenticatesUsers.php',
          line: 32,
          function: 'login',
          class: 'Illuminate\\Foundation\\Auth\\AuthenticatesUsers',
          type: '->'
        },
        {
          file: '/app/vendor/laravel/framework/src/Illuminate/Routing/Controller.php',
          line: 54,
          function: 'callAction',
          class: 'Illuminate\\Routing\\Controller',
          type: '->'
        }
      ],
      context: {
        request: {
          url: 'http://localhost:8000/login',
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: {
            email: 'admin@example.com',
            password: '********'
          },
          ip: '127.0.0.1'
        },
        user: null,
        environment: {
          framework: 'Laravel',
          framework_version: '10.0.0',
          php_version: '8.2.0',
          environment: 'local',
          debug: true
        },
        database: {
          connection: 'mysql',
          query: 'select * from `users` where `email` = ? limit 1',
          bindings: ['admin@example.com'],
          time: 2.45
        }
      },
      timestamp: Date.now(),
      flag: 'red'
    }

    await this.sendData(data)
  }

  // React Exception
  async sendReactException() {
    const data = {
      type: 'exception',
      framework: 'react',
      name: 'Error',
      message:
        'Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.',
      stack: `Error: Maximum update depth exceeded
    at checkForNestedUpdates (react-dom.development.js:23093:15)
    at scheduleUpdateOnFiber (react-dom.development.js:21164:3)
    at Object.enqueueSetState (react-dom.development.js:12639:5)
    at UserList.setState (react.development.js:336:16)
    at UserList.componentDidUpdate (UserList.jsx:32:10)
    at commitLifeCycles (react-dom.development.js:19858:22)`,
      file: '/src/components/UserList.jsx',
      line: 32,
      column: 10,
      componentStack: `
    in UserList (at Dashboard.jsx:45)
    in div (at Dashboard.jsx:42)
    in Dashboard (at App.jsx:23)
    in Router (at App.jsx:20)
    in App (at index.js:10)`,
      component: 'UserList',
      props: {
        users: [],
        onUpdate: '[Function]',
        loading: false
      },
      context: {
        request: {
          url: 'http://localhost:3000/dashboard/users',
          method: 'GET',
          user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        },
        environment: {
          framework: 'React',
          framework_version: '18.2.0',
          node_version: '18.16.0',
          environment: 'development'
        }
      },
      timestamp: Date.now(),
      flag: 'red'
    }

    await this.sendData(data)
  }

  // Node.js Exception
  async sendNodeException() {
    const data = {
      type: 'exception',
      framework: 'node',
      name: 'TypeError',
      message: "Cannot read properties of undefined (reading 'name')",
      stack: `TypeError: Cannot read properties of undefined (reading 'name')
    at getUserName (/app/services/userService.js:15:23)
    at /app/routes/api/users.js:45:20
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)
    at next (/app/node_modules/express/lib/router/route.js:137:13)
    at Route.dispatch (/app/node_modules/express/lib/router/route.js:112:3)`,
      file: '/app/services/userService.js',
      line: 15,
      column: 23,
      trace: [
        {
          function: 'getUserName',
          file: '/app/services/userService.js',
          line: 15,
          column: 23,
          code_snippet: [
            'function getUserName(user) {',
            '  // Missing null check',
            '  return user.name.toUpperCase(); // TypeError here',
            '}',
            '',
            'module.exports = { getUserName };'
          ]
        },
        {
          file: '/app/routes/api/users.js',
          line: 45,
          column: 20
        }
      ],
      context: {
        request: {
          url: '/api/users/123',
          method: 'GET',
          headers: {
            authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          },
          params: {
            id: '123'
          },
          ip: '192.168.1.100'
        },
        environment: {
          framework: 'Express',
          node_version: '18.16.0',
          environment: 'production'
        }
      },
      timestamp: Date.now(),
      flag: 'red'
    }

    await this.sendData(data)
  }

  // Vue.js Exception
  async sendVueException() {
    const data = {
      type: 'exception',
      framework: 'vue',
      name: 'Vue warn',
      message: 'Error in mounted hook: "ReferenceError: users is not defined"',
      stack: `ReferenceError: users is not defined
    at Proxy.mounted (UserList.vue:45:10)
    at callWithErrorHandling (runtime-core.esm-bundler.js:155:36)
    at callWithAsyncErrorHandling (runtime-core.esm-bundler.js:164:21)
    at Array.hook.__weh.hook.__weh (runtime-core.esm-bundler.js:2667:29)`,
      file: '/src/components/UserList.vue',
      line: 45,
      component: 'UserList',
      info: 'mounted hook',
      context: {
        request: {
          url: 'http://localhost:8080/users',
          method: 'GET',
          user_agent: 'Mozilla/5.0 (X11; Linux x86_64)'
        },
        environment: {
          framework: 'Vue',
          framework_version: '3.3.0',
          environment: 'development'
        }
      },
      timestamp: Date.now(),
      flag: 'yellow',
      vue: true
    }

    await this.sendData(data)
  }

  // Symfony Exception
  async sendSymfonyException() {
    const data = {
      type: 'exception',
      framework: 'symfony',
      exception: 'Symfony\\Component\\HttpKernel\\Exception\\NotFoundHttpException',
      message: 'No route found for "GET /api/v2/products"',
      file: '/vendor/symfony/http-kernel/EventListener/RouterListener.php',
      line: 136,
      trace: [
        {
          class: 'Symfony\\Component\\HttpKernel\\EventListener\\RouterListener',
          function: 'onKernelRequest',
          file: '/vendor/symfony/event-dispatcher/EventDispatcher.php',
          line: 230,
          type: '->',
          code_snippet: [
            'public function onKernelRequest(RequestEvent $event): void',
            '{',
            '    $request = $event->getRequest();',
            '',
            "    if ($request->attributes->has('_controller')) {",
            '        return;',
            '    }',
            '',
            '    throw new NotFoundHttpException($message);'
          ]
        }
      ],
      context: {
        request: {
          url: '/api/v2/products',
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          ip: '10.0.0.1'
        },
        environment: {
          framework: 'Symfony',
          framework_version: '6.3.0',
          php_version: '8.2.0',
          environment: 'dev'
        }
      },
      timestamp: Date.now(),
      flag: 'yellow'
    }

    await this.sendData(data)
  }

  // PHP Fatal Error
  async sendPHPFatalError() {
    const data = {
      type: 'exception',
      framework: 'vanilla-php',
      exception: 'Fatal Error',
      message: 'Uncaught Error: Call to undefined function connectToDatabase()',
      file: '/var/www/html/index.php',
      line: 23,
      severity: 'fatal',
      stack: `Fatal error: Uncaught Error: Call to undefined function connectToDatabase() in /var/www/html/index.php:23
Stack trace:
#0 {main}
  thrown in /var/www/html/index.php on line 23`,
      context: {
        request: {
          url: '/index.php',
          method: 'GET',
          ip: '127.0.0.1',
          user_agent: 'curl/7.68.0'
        },
        environment: {
          framework: 'vanilla-php',
          php_version: '8.1.0',
          sapi: 'apache2handler'
        }
      },
      timestamp: Date.now(),
      flag: 'red'
    }

    await this.sendData(data)
  }

  // Regular data dump (non-exception)
  async sendDataDump() {
    const data = {
      type: 'data',
      message: 'User login successful',
      user: {
        id: 1,
        email: 'user@example.com',
        name: 'John Doe',
        roles: ['admin', 'user']
      },
      action: 'login',
      ip: '192.168.1.100',
      timestamp: Date.now(),
      flag: 'green'
    }

    await this.sendData(data)
  }

  // Send all test exceptions
  async sendAllExceptions() {
    console.log('🚀 Sending test exceptions to DumpeX...\n')

    const tests = [
      { name: 'Laravel QueryException', fn: () => this.sendLaravelException() },
      { name: 'React Update Depth Error', fn: () => this.sendReactException() },
      { name: 'Node.js TypeError', fn: () => this.sendNodeException() },
      { name: 'Vue.js Warning', fn: () => this.sendVueException() },
      { name: 'Symfony NotFound', fn: () => this.sendSymfonyException() },
      { name: 'PHP Fatal Error', fn: () => this.sendPHPFatalError() },
      { name: 'Regular Data Dump', fn: () => this.sendDataDump() }
    ]

    for (const test of tests) {
      console.log(`📤 Sending: ${test.name}`)
      try {
        await test.fn()
        await new Promise((resolve) => setTimeout(resolve, 500)) // Small delay between sends
      } catch (error) {
        console.error(`   Failed: ${error.message}`)
      }
    }

    console.log('\n✨ All test data sent!')
    console.log(
      'Check your DumpeX application to see the exceptions with their stack traces and solutions.'
    )
  }
}

// Run the test client
async function main() {
  const client = new ExceptionTestClient('localhost', 21234)

  console.log('═══════════════════════════════════════════')
  console.log('     DumpeX Exception Test Client')
  console.log('═══════════════════════════════════════════\n')

  console.log('Options:')
  console.log('1. Send all test exceptions')
  console.log('2. Send Laravel exception only')
  console.log('3. Send React exception only')
  console.log('4. Send Node.js exception only')
  console.log('5. Send continuous random exceptions (stress test)')
  console.log('\nPress Ctrl+C to exit\n')

  // Send all exceptions by default
  await client.sendAllExceptions()

  // Optional: Continuous sending for testing
  if (process.argv.includes('--continuous')) {
    console.log('\n🔄 Starting continuous mode (sending random exceptions every 2 seconds)...\n')

    const methods = [
      () => client.sendLaravelException(),
      () => client.sendReactException(),
      () => client.sendNodeException(),
      () => client.sendVueException(),
      () => client.sendSymfonyException(),
      () => client.sendPHPFatalError(),
      () => client.sendDataDump()
    ]

    setInterval(async () => {
      const randomMethod = methods[Math.floor(Math.random() * methods.length)]
      await randomMethod()
    }, 2000)
  }
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

// Run
main().catch(console.error)
