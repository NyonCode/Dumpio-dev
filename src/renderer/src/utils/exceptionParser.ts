export interface StackFrame {
  file: string
  line: number
  column?: number
  function?: string
  class?: string
  type?: string // -> or ::
  args?: any[]
  code?: string[]
  preview?: string
}

export interface ExceptionContext {
  request?: {
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: any
    query?: Record<string, string>
    params?: Record<string, string>
    ip?: string
    userAgent?: string
  }
  user?: {
    id?: string | number
    email?: string
    name?: string
    roles?: string[]
  }
  session?: Record<string, any>
  environment?: {
    php_version?: string
    node_version?: string
    framework?: string
    framework_version?: string
    environment?: string // production, development, staging
    debug?: boolean
  }
  database?: {
    connection?: string
    query?: string
    bindings?: any[]
    time?: number
  }
  custom?: Record<string, any>
}

export interface ExceptionSolution {
  title: string
  description: string
  link?: string
  code?: string
  probability?: number // 0-100
}

export interface ParsedException {
  type: 'exception'
  framework?:
    | 'laravel'
    | 'symfony'
    | 'vanilla-php'
    | 'node'
    | 'react'
    | 'vue'
    | 'alpine'
    | 'vanilla-js'
  error: {
    class: string
    message: string
    code?: string | number
    file?: string
    line?: number
    severity?: string
  }
  stackTrace: StackFrame[]
  context: ExceptionContext
  solutions: ExceptionSolution[]
  snippets?: {
    failing?: {
      file: string
      lines: Array<{ number: number; content: string; highlighted?: boolean }>
    }
    related?: Array<{
      file: string
      lines: Array<{ number: number; content: string }>
    }>
  }
  tags?: string[]
  timestamp: number
  flag?: string
}

// Pattern matchers for different frameworks
const FRAMEWORK_PATTERNS = {
  laravel: {
    exception: /^(Illuminate\\|App\\)/,
    stackFrame: /at\s+(.+?)\s+in\s+(.+?):(\d+)/,
    contextKeys: ['request', 'user', 'session', 'view', 'queries']
  },
  symfony: {
    exception: /^(Symfony\\|App\\)/,
    stackFrame: /at\s+(.+?)\s+\((.+?):(\d+)\)/,
    contextKeys: ['request', 'user', 'session', 'profiler']
  },
  vanillaPHP: {
    exception: /^(Error|Exception|TypeError|ParseError)/,
    stackFrame: /#\d+\s+(.+?)\((\d+)\):\s+(.+)/,
    contextKeys: ['_SERVER', '_SESSION', '_POST', '_GET']
  },
  node: {
    exception: /^(Error|TypeError|ReferenceError|SyntaxError)/,
    stackFrame: /at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/,
    contextKeys: ['request', 'process', 'environment']
  },
  react: {
    exception: /^(Error|TypeError|ReferenceError|Invariant Violation)/,
    stackFrame: /at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/,
    contextKeys: ['props', 'state', 'component', 'route']
  },
  vue: {
    exception: /^(Error|TypeError|Vue warn)/,
    stackFrame: /at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/,
    contextKeys: ['component', 'props', 'data', 'route']
  }
}

// Solution database for common errors
const SOLUTION_DATABASE: Record<string, ExceptionSolution[]> = {
  'Class not found': [
    {
      title: 'Check autoloading configuration',
      description: 'Make sure the class is properly namespaced and autoloaded',
      code: 'composer dump-autoload',
      probability: 80
    },
    {
      title: 'Check file naming and location',
      description: 'Ensure the file name matches the class name and is in the correct directory',
      probability: 70
    }
  ],
  SQLSTATE: [
    {
      title: 'Check database connection',
      description: 'Verify database credentials and server is running',
      probability: 75
    },
    {
      title: 'Check table/column existence',
      description: 'Ensure the referenced table and columns exist in your database',
      code: 'php artisan migrate',
      probability: 65
    }
  ],
  'Cannot read property': [
    {
      title: 'Check for undefined/null values',
      description: 'Add null/undefined checks before accessing properties',
      code: 'if (object && object.property) { ... }',
      probability: 85
    },
    {
      title: 'Use optional chaining',
      description: 'Use optional chaining operator for safe property access',
      code: 'object?.property?.nested',
      probability: 75
    }
  ],
  'Unexpected token': [
    {
      title: 'Check syntax',
      description: 'Look for missing brackets, semicolons, or quotes',
      probability: 90
    },
    {
      title: 'Check JSON validity',
      description: "If parsing JSON, ensure it's properly formatted",
      link: 'https://jsonlint.com',
      probability: 70
    }
  ],
  CORS: [
    {
      title: 'Configure CORS headers',
      description: 'Add appropriate CORS headers to your server response',
      code: 'Access-Control-Allow-Origin: *',
      probability: 95
    },
    {
      title: 'Use proxy in development',
      description: 'Configure a proxy in your development server',
      probability: 60
    }
  ],
  'Target container is not a DOM element': [
    {
      title: 'Check element exists',
      description: 'Ensure the root element exists before React renders',
      code: 'document.getElementById("root")',
      probability: 90
    },
    {
      title: 'Wait for DOM ready',
      description: 'Make sure DOM is loaded before mounting React',
      code: 'document.addEventListener("DOMContentLoaded", ...)',
      probability: 80
    }
  ],
  'Maximum update depth exceeded': [
    {
      title: 'Check useEffect dependencies',
      description: 'Ensure useEffect dependencies are correct to avoid infinite loops',
      code: 'useEffect(() => {...}, [dependency])',
      probability: 85
    },
    {
      title: 'Avoid setState in render',
      description: "Don't call setState directly in render method",
      probability: 75
    }
  ]
}

export class ExceptionParser {
  static parse(payload: any): ParsedException | null {
    // Check if payload contains exception data
    if (!this.isException(payload)) {
      return null
    }

    const framework = this.detectFramework(payload)
    const error = this.parseError(payload, framework)
    const stackTrace = this.parseStackTrace(payload, framework)
    const context = this.parseContext(payload, framework)
    const solutions = this.findSolutions(error, framework)
    const snippets = this.parseCodeSnippets(payload)

    return {
      type: 'exception',
      framework,
      error,
      stackTrace,
      context,
      solutions,
      snippets,
      tags: this.generateTags(error, framework),
      timestamp: payload.timestamp || Date.now(),
      flag: this.determineFlag(error)
    }
  }

  private static isException(payload: any): boolean {
    return !!(
      payload.exception ||
      payload.error ||
      payload.stack ||
      payload.stackTrace ||
      payload.trace ||
      (payload.type && payload.type === 'exception') ||
      (payload.message && (payload.file || payload.line || payload.stack))
    )
  }

  private static detectFramework(payload: any): ParsedException['framework'] {
    // Check explicit framework indicator
    if (payload.framework) {
      return payload.framework as ParsedException['framework']
    }

    // Check Laravel specific
    if (
      payload.exception?.includes('Illuminate\\') ||
      payload.framework_version?.includes('Laravel')
    ) {
      return 'laravel'
    }

    // Check Symfony specific
    if (payload.exception?.includes('Symfony\\') || payload.context?.profiler) {
      return 'symfony'
    }

    // Check Node.js
    if (payload.platform === 'node' || payload.process?.versions?.node) {
      return 'node'
    }

    // Check React
    if (payload.componentStack || payload.component || payload.props !== undefined) {
      return 'react'
    }

    // Check Vue
    if (payload.vm || payload.component?.$options || payload.vue) {
      return 'vue'
    }

    // Check Alpine
    if (payload.alpine || payload.$el) {
      return 'alpine'
    }

    // Default to vanilla based on error type
    if (payload.exception || payload.file?.endsWith('.php')) {
      return 'vanilla-php'
    }

    return 'vanilla-js'
  }

  private static parseError(payload: any, framework?: string): ParsedException['error'] {
    const error: ParsedException['error'] = {
      class: 'Error',
      message: 'Unknown error'
    }

    // Extract error class
    if (payload.exception) {
      error.class = payload.exception
    } else if (payload.error?.name) {
      error.class = payload.error.name
    } else if (payload.type) {
      error.class = payload.type
    }

    // Extract message
    if (payload.message) {
      error.message = payload.message
    } else if (payload.error?.message) {
      error.message = payload.error.message
    }

    // Extract file and line
    if (payload.file) error.file = payload.file
    if (payload.line) error.line = payload.line
    if (payload.error?.file) error.file = payload.error.file
    if (payload.error?.line) error.line = payload.error.line

    // Extract code
    if (payload.code) error.code = payload.code
    if (payload.error?.code) error.code = payload.error.code

    // Extract severity
    if (payload.severity) error.severity = payload.severity
    if (payload.level) error.severity = payload.level

    return error
  }

  private static parseStackTrace(payload: any, framework?: string): StackFrame[] {
    const frames: StackFrame[] = []

    // Try different stack trace formats
    let stackData = payload.trace || payload.stackTrace || payload.stack || payload.error?.stack

    if (Array.isArray(stackData)) {
      // Already parsed stack trace (Laravel/Symfony format)
      return stackData.map((frame) => this.parseStackFrame(frame, framework))
    } else if (typeof stackData === 'string') {
      // Parse string stack trace
      const lines = stackData.split('\n')
      for (const line of lines) {
        const frame = this.parseStackFrameString(line, framework)
        if (frame) frames.push(frame)
      }
    }

    return frames
  }

  private static parseStackFrame(frame: any, framework?: string): StackFrame {
    if (typeof frame === 'object') {
      return {
        file: frame.file || frame.filename || '',
        line: frame.line || frame.lineno || 0,
        column: frame.column || frame.colno,
        function: frame.function || frame.method || frame.name,
        class: frame.class,
        type: frame.type,
        args: frame.args,
        code: frame.code_snippet || frame.context,
        preview: frame.preview
      }
    }

    return (
      this.parseStackFrameString(frame, framework) || {
        file: '',
        line: 0
      }
    )
  }

  private static parseStackFrameString(line: string, framework?: string): StackFrame | null {
    // Node.js/JavaScript format: at functionName (file:line:column)
    const jsMatch = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/)
    if (jsMatch) {
      return {
        function: jsMatch[1]?.trim(),
        file: jsMatch[2],
        line: parseInt(jsMatch[3]),
        column: parseInt(jsMatch[4])
      }
    }

    // PHP format: #0 file(line): function()
    const phpMatch = line.match(/#\d+\s+(.+?)\((\d+)\):\s+(.+)/)
    if (phpMatch) {
      return {
        file: phpMatch[1],
        line: parseInt(phpMatch[2]),
        function: phpMatch[3]
      }
    }

    // Laravel/Symfony format: at Class->method() in file:line
    const laravelMatch = line.match(/at\s+(.+?)(->|::)(.+?)\s+in\s+(.+?):(\d+)/)
    if (laravelMatch) {
      return {
        class: laravelMatch[1],
        type: laravelMatch[2],
        function: laravelMatch[3],
        file: laravelMatch[4],
        line: parseInt(laravelMatch[5])
      }
    }

    return null
  }

  private static parseContext(payload: any, framework?: string): ExceptionContext {
    const context: ExceptionContext = {}

    // Parse request context
    if (payload.request || payload.context?.request) {
      const req = payload.request || payload.context.request
      context.request = {
        url: req.url || req.uri,
        method: req.method,
        headers: req.headers,
        body: req.body || req.data,
        query: req.query || req.get,
        params: req.params || req.attributes,
        ip: req.ip || req.client_ip,
        userAgent: req.user_agent || req.userAgent
      }
    }

    // Parse user context
    if (payload.user || payload.context?.user) {
      const user = payload.user || payload.context.user
      context.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles
      }
    }

    // Parse session
    if (payload.session || payload.context?.session) {
      context.session = payload.session || payload.context.session
    }

    // Parse environment
    if (payload.environment || payload.context?.environment) {
      const env = payload.environment || payload.context.environment
      context.environment = {
        php_version: env.php_version || payload.php,
        node_version: env.node_version || payload.node,
        framework: framework,
        framework_version: env.framework_version || payload.version,
        environment: env.environment || payload.env || payload.app_env,
        debug: env.debug || payload.debug || payload.app_debug
      }
    }

    // Parse database context
    if (payload.query || payload.queries || payload.database) {
      const db = payload.database || {}
      context.database = {
        connection: db.connection || payload.connection,
        query: db.query || payload.query || payload.sql,
        bindings: db.bindings || payload.bindings,
        time: db.time || payload.time
      }
    }

    // Add any custom context
    if (payload.context && typeof payload.context === 'object') {
      const { request, user, session, environment, database, ...custom } = payload.context
      if (Object.keys(custom).length > 0) {
        context.custom = custom
      }
    }

    return context
  }

  private static findSolutions(
    error: ParsedException['error'],
    framework?: string
  ): ExceptionSolution[] {
    const solutions: ExceptionSolution[] = []
    const errorMessage = error.message.toLowerCase()
    const errorClass = error.class.toLowerCase()

    // Search solution database
    for (const [pattern, solutionList] of Object.entries(SOLUTION_DATABASE)) {
      if (
        errorMessage.includes(pattern.toLowerCase()) ||
        errorClass.includes(pattern.toLowerCase())
      ) {
        solutions.push(...solutionList)
      }
    }

    // Add framework-specific solutions
    if (framework === 'laravel') {
      if (errorMessage.includes('csrf')) {
        solutions.push({
          title: 'Add CSRF token',
          description: 'Include CSRF token in your form or AJAX request',
          code: '@csrf or { _token: "{{ csrf_token() }}" }',
          probability: 95
        })
      }
      if (errorMessage.includes('mass assignment')) {
        solutions.push({
          title: 'Add to fillable array',
          description: 'Add the field to the $fillable array in your model',
          code: 'protected $fillable = ["field_name"];',
          probability: 90
        })
      }
    }

    if (framework === 'react') {
      if (errorMessage.includes('hooks')) {
        solutions.push({
          title: 'Check Hook rules',
          description: 'Hooks can only be called at the top level of function components',
          link: 'https://reactjs.org/docs/hooks-rules.html',
          probability: 85
        })
      }
    }

    if (framework === 'vue') {
      if (errorMessage.includes('cannot find element')) {
        solutions.push({
          title: 'Check element mounting',
          description: 'Ensure the target element exists when Vue mounts',
          code: 'new Vue({ el: "#app" })',
          probability: 90
        })
      }
    }

    // Sort by probability
    return solutions.sort((a, b) => (b.probability || 0) - (a.probability || 0))
  }

  private static parseCodeSnippets(payload: any): ParsedException['snippets'] {
    const snippets: ParsedException['snippets'] = {}

    // Parse failing code snippet
    if (payload.code_snippet || payload.snippet || payload.context_lines) {
      const lines = payload.code_snippet || payload.snippet || payload.context_lines
      if (Array.isArray(lines)) {
        snippets.failing = {
          file: payload.file || '',
          lines: lines.map((line, index) => ({
            number: (payload.line || 0) - Math.floor(lines.length / 2) + index,
            content: line,
            highlighted: index === Math.floor(lines.length / 2)
          }))
        }
      }
    }

    // Parse related code snippets
    if (payload.related_snippets && Array.isArray(payload.related_snippets)) {
      snippets.related = payload.related_snippets.map((snippet) => ({
        file: snippet.file,
        lines: snippet.lines || []
      }))
    }

    return Object.keys(snippets).length > 0 ? snippets : undefined
  }

  private static generateTags(error: ParsedException['error'], framework?: string): string[] {
    const tags: string[] = []

    // Add framework tag
    if (framework) tags.push(framework)

    // Add error type tags
    if (error.class) {
      if (error.class.includes('SQL')) tags.push('database')
      if (error.class.includes('Auth')) tags.push('authentication')
      if (error.class.includes('Validation')) tags.push('validation')
      if (error.class.includes('NotFound')) tags.push('404')
      if (error.class.includes('Permission') || error.class.includes('Forbidden'))
        tags.push('authorization')
      if (error.class.includes('Timeout')) tags.push('timeout')
      if (error.class.includes('Network')) tags.push('network')
    }

    // Add severity tag
    if (error.severity) {
      tags.push(error.severity.toLowerCase())
    }

    return tags
  }

  private static determineFlag(error: ParsedException['error']): string {
    // Determine flag color based on error severity
    const errorClass = error.class.toLowerCase()
    const message = error.message.toLowerCase()

    if (errorClass.includes('fatal') || errorClass.includes('critical')) {
      return 'red'
    }
    if (errorClass.includes('warning') || errorClass.includes('deprecated')) {
      return 'yellow'
    }
    if (errorClass.includes('notice') || errorClass.includes('info')) {
      return 'blue'
    }
    if (message.includes('sql') || message.includes('database')) {
      return 'purple'
    }

    return 'red' // Default for exceptions
  }

  static formatForDisplay(exception: ParsedException): any {
    return {
      type: 'exception',
      framework: exception.framework,
      error: exception.error,
      stack_trace: exception.stackTrace,
      context: exception.context,
      solutions: exception.solutions,
      snippets: exception.snippets,
      tags: exception.tags,
      timestamp: exception.timestamp,
      flag: exception.flag,

      // Add formatted summary for quick view
      summary: {
        title: `${exception.error.class}: ${exception.error.message}`,
        location: exception.error.file
          ? `${exception.error.file}:${exception.error.line}`
          : undefined,
        framework: exception.framework,
        solutions_count: exception.solutions.length,
        has_context: Object.keys(exception.context).length > 0
      }
    }
  }
}

// Helper function to generate test data
export function generateExceptionTestData(framework: ParsedException['framework']): any {
  const examples: Record<ParsedException['framework'], any> = {
    laravel: {
      exception: 'Illuminate\\Database\\QueryException',
      message:
        "SQLSTATE[42S02]: Base table or view not found: 1146 Table 'database.users' doesn't exist",
      file: '/app/vendor/laravel/framework/src/Illuminate/Database/Connection.php',
      line: 712,
      trace: [
        {
          file: '/app/app/Http/Controllers/UserController.php',
          line: 45,
          function: 'index',
          class: 'App\\Http\\Controllers\\UserController',
          type: '->',
          code_snippet: [
            '    public function index()',
            '    {',
            '        $users = User::all(); // <-- Error here',
            "        return view('users.index', compact('users'));",
            '    }'
          ]
        }
      ],
      context: {
        request: {
          url: 'http://localhost/users',
          method: 'GET'
        },
        environment: {
          framework: 'Laravel',
          framework_version: '10.0',
          php_version: '8.2'
        }
      },
      sql: 'select * from `users`',
      bindings: []
    },
    symfony: {
      exception: 'Symfony\\Component\\HttpKernel\\Exception\\NotFoundHttpException',
      message: 'No route found for "GET /api/users"',
      file: '/app/vendor/symfony/http-kernel/EventListener/RouterListener.php',
      line: 136,
      trace: [
        {
          class: 'Symfony\\Component\\HttpKernel\\EventListener\\RouterListener',
          function: 'onKernelRequest',
          file: '/app/vendor/symfony/event-dispatcher/EventDispatcher.php',
          line: 230
        }
      ],
      context: {
        request: {
          url: '/api/users',
          method: 'GET'
        }
      }
    },
    'vanilla-php': {
      type: 'Error',
      message: 'Call to undefined function myFunction()',
      file: '/var/www/html/index.php',
      line: 15,
      stack:
        'Error: Call to undefined function myFunction() in /var/www/html/index.php:15\nStack trace:\n#0 {main}'
    },
    node: {
      name: 'TypeError',
      message: "Cannot read property 'name' of undefined",
      stack:
        "TypeError: Cannot read property 'name' of undefined\n    at getUserName (/app/services/user.js:10:15)\n    at /app/routes/users.js:25:20",
      file: '/app/services/user.js',
      line: 10,
      column: 15
    },
    react: {
      name: 'Error',
      message: 'Maximum update depth exceeded',
      componentStack: '\n    in UserList (at App.js:45)\n    in App (at index.js:10)',
      file: '/src/components/UserList.jsx',
      line: 32,
      component: 'UserList',
      props: { users: [] }
    },
    vue: {
      message: "Cannot read property '$refs' of undefined",
      file: '/src/components/UserForm.vue',
      line: 45,
      component: 'UserForm',
      vue: true
    },
    alpine: {
      message: 'x-data attribute not found',
      file: '/index.html',
      line: 120,
      alpine: true
    },
    'vanilla-js': {
      name: 'ReferenceError',
      message: 'myVariable is not defined',
      stack:
        'ReferenceError: myVariable is not defined\n    at handleClick (script.js:15:5)\n    at HTMLButtonElement.onclick (index.html:10:45)'
    }
  }

  return examples[framework] || examples['vanilla-js']
}
