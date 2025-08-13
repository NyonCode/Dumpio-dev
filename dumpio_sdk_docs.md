# Dumpio SDK Developer Documentation

Complete guide for creating client libraries and integrations for the Dumpio TCP dump viewer.

## Table of Contents

1. [Protocol Overview](#protocol-overview)
2. [Connection Management](#connection-management)
3. [Data Formats](#data-formats)
4. [Framework-Specific Implementation](#framework-specific-implementation)
5. [SDK Architecture](#sdk-architecture)
6. [Error Handling](#error-handling)
7. [Performance Guidelines](#performance-guidelines)
8. [Testing & Validation](#testing--validation)
9. [Reference Implementations](#reference-implementations)

## Protocol Overview

### Communication Protocol

Dumpio uses **TCP sockets** for reliable, ordered data transmission. Each message is sent as a complete JSON object.

```
Client Application ─TCP Socket─> Dumpio Server (Port: 21234)
```

### Message Format

All messages must be valid JSON objects sent as UTF-8 encoded strings:

```json
{
  "message": "Required: Human-readable description",
  "timestamp": 1640995200000,
  "flag": "blue",
  "type": "optional_type_hint"
}
```

### Connection Lifecycle

```
1. TCP Connect    → localhost:21234
2. Send JSON      → {"message": "data"}
3. Close/Keep     → Connection can be reused
4. Disconnect     → Automatic cleanup
```

## Connection Management

### Basic Connection Pattern

```typescript
// Pseudo-code for connection management
class DumpioClient {
  private socket: Socket
  private host: string = 'localhost'
  private port: number = 21234
  
  async connect(): Promise<void> {
    this.socket = new Socket()
    await this.socket.connect(this.port, this.host)
  }
  
  async send(data: object): Promise<void> {
    const json = JSON.stringify(data)
    await this.socket.write(json)
  }
  
  async disconnect(): Promise<void> {
    await this.socket.close()
  }
}
```

### Connection Strategies

#### 1. Single-Shot Connection
```typescript
// Best for: Occasional dumps, simple logging
async function sendDump(data: object) {
  const client = new DumpioClient()
  await client.connect()
  await client.send(data)
  await client.disconnect()
}
```

#### 2. Persistent Connection
```typescript
// Best for: High-frequency dumps, real-time monitoring
class PersistentDumpioClient {
  private client: DumpioClient
  
  async initialize() {
    this.client = new DumpioClient()
    await this.client.connect()
  }
  
  async dump(data: object) {
    await this.client.send(data)
  }
  
  async close() {
    await this.client.disconnect()
  }
}
```

#### 3. Connection Pool
```typescript
// Best for: High-throughput applications, multiple threads
class DumpioPool {
  private connections: DumpioClient[] = []
  private maxConnections: number = 5
  
  async getConnection(): Promise<DumpioClient> {
    // Round-robin or least-used strategy
  }
  
  async releaseConnection(client: DumpioClient): void {
    // Return to pool
  }
}
```

## Data Formats

### Core Message Structure

Every message **MUST** include these fields:

```typescript
interface CoreMessage {
  message: string        // Human-readable description
  timestamp?: number     // Unix timestamp in milliseconds
  flag?: Flag           // Color categorization
  channel?: string      // Logical grouping
  type?: string         // Type hint for parser
}

type Flag = 'red' | 'yellow' | 'blue' | 'gray' | 'purple' | 'pink' | 'green'
```

### 1. Basic Data Dump

```json
{
  "message": "User login successful",
  "timestamp": 1640995200000,
  "flag": "green",
  "channel": "auth",
  "user_id": 123,
  "ip_address": "192.168.1.100",
  "session_id": "abc123def456",
  "metadata": {
    "browser": "Chrome/96.0",
    "platform": "Windows",
    "referrer": "https://app.example.com/login"
  }
}
```

### 2. Exception/Error Format

#### Standard Exception Structure
```typescript
interface ExceptionDump {
  type: "exception"
  exception: string           // Exception class name
  message: string            // Error message
  file?: string             // Source file path
  line?: number             // Line number
  column?: number           // Column number (JavaScript)
  code?: string | number    // Error code
  severity?: string         // error, warning, notice
  stack?: string           // Raw stack trace
  trace?: StackFrame[]     // Parsed stack trace
  context?: ExceptionContext
  framework?: string       // Framework identifier
  timestamp?: number
  flag?: Flag
}
```

#### Stack Frame Structure
```typescript
interface StackFrame {
  file: string              // File path
  line: number              // Line number
  column?: number           // Column number
  function?: string         // Function name
  class?: string           // Class name
  type?: string            // Method type (-> or ::)
  args?: any[]             // Function arguments
  code?: string[]          // Code context lines
  preview?: string         // Short preview
}
```

#### Exception Context
```typescript
interface ExceptionContext {
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
    python_version?: string
    go_version?: string
    framework?: string
    framework_version?: string
    environment?: string
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
```

#### Framework-Specific Examples

**PHP/Laravel Exception:**
```json
{
  "type": "exception",
  "framework": "laravel",
  "exception": "Illuminate\\Database\\QueryException",
  "message": "SQLSTATE[42S02]: Base table or view not found: 1146 Table 'users' doesn't exist",
  "file": "/app/app/Http/Controllers/UserController.php",
  "line": 45,
  "code": "42S02",
  "severity": "error",
  "trace": [
    {
      "file": "/app/app/Http/Controllers/UserController.php",
      "line": 45,
      "function": "index",
      "class": "App\\Http\\Controllers\\UserController",
      "type": "->",
      "code": [
        "    public function index()",
        "    {",
        "        $users = User::all(); // Error occurs here",
        "        return view('users.index', compact('users'));",
        "    }"
      ]
    }
  ],
  "context": {
    "request": {
      "url": "http://localhost/users",
      "method": "GET",
      "headers": {
        "Accept": "text/html",
        "User-Agent": "Mozilla/5.0..."
      }
    },
    "environment": {
      "framework": "Laravel",
      "framework_version": "10.0.0",
      "php_version": "8.2.0",
      "environment": "local",
      "debug": true
    },
    "database": {
      "connection": "mysql",
      "query": "select * from `users`",
      "bindings": [],
      "time": 0.5
    }
  },
  "timestamp": 1640995200000,
  "flag": "red"
}
```

**JavaScript/Node.js Exception:**
```json
{
  "type": "exception",
  "framework": "node",
  "exception": "TypeError",
  "message": "Cannot read property 'name' of undefined",
  "file": "/app/services/user.js",
  "line": 45,
  "column": 15,
  "stack": "TypeError: Cannot read property 'name' of undefined\n    at getUserName (/app/services/user.js:45:15)\n    at /app/routes/users.js:25:20",
  "trace": [
    {
      "function": "getUserName",
      "file": "/app/services/user.js",
      "line": 45,
      "column": 15
    },
    {
      "file": "/app/routes/users.js",
      "line": 25,
      "column": 20
    }
  ],
  "context": {
    "request": {
      "url": "/api/users/123",
      "method": "GET"
    },
    "environment": {
      "node_version": "18.0.0",
      "framework": "express",
      "framework_version": "4.18.0",
      "environment": "development"
    }
  },
  "timestamp": 1640995200000,
  "flag": "red"
}
```

**Python Exception:**
```json
{
  "type": "exception",
  "framework": "django",
  "exception": "DoesNotExist",
  "message": "User matching query does not exist",
  "file": "/app/views.py",
  "line": 42,
  "traceback": "Traceback (most recent call last):\n  File \"/app/views.py\", line 42, in get_user\n    user = User.objects.get(id=user_id)\nUser.DoesNotExist: User matching query does not exist",
  "trace": [
    {
      "file": "/app/views.py",
      "line": 42,
      "function": "get_user",
      "code": [
        "def get_user(user_id):",
        "    try:",
        "        user = User.objects.get(id=user_id)  # Error here",
        "        return user",
        "    except User.DoesNotExist:"
      ]
    }
  ],
  "context": {
    "request": {
      "url": "/users/999/",
      "method": "GET"
    },
    "environment": {
      "python_version": "3.11.0",
      "framework": "Django",
      "framework_version": "4.2.0"
    },
    "locals": {
      "user_id": 999
    }
  },
  "timestamp": 1640995200000,
  "flag": "red"
}
```

### 3. SQL Query Format

```json
{
  "type": "query",
  "message": "User lookup query",
  "sql": "SELECT * FROM users WHERE email = ? AND active = ?",
  "bindings": ["user@example.com", true],
  "time": 15.5,
  "rows": 1,
  "connection": "mysql",
  "database": "app_production",
  "query_type": "select",
  "context": {
    "controller": "UserController",
    "action": "show",
    "request_id": "abc123"
  },
  "timestamp": 1640995200000,
  "flag": "purple"
}
```

### 4. HTTP Request Format

```json
{
  "type": "http",
  "message": "API request to create user",
  "method": "POST",
  "url": "/api/users",
  "status": 201,
  "response_time": 120,
  "request_size": 1024,
  "response_size": 512,
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer ...",
    "User-Agent": "Mobile App/1.0"
  },
  "body": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "response": {
    "id": 123,
    "name": "John Doe",
    "created_at": "2024-01-01T12:00:00Z"
  },
  "context": {
    "client_ip": "192.168.1.100",
    "user_id": 456,
    "session_id": "sess_abc123"
  },
  "timestamp": 1640995200000,
  "flag": "blue"
}
```

### 5. Log Entry Format

```json
{
  "type": "log",
  "message": "User authentication failed",
  "level": "warning",
  "category": "security",
  "event": "auth_failed",
  "details": {
    "email": "attacker@evil.com",
    "ip": "192.168.1.100",
    "attempts": 5,
    "locked_until": "2024-01-01T13:00:00Z"
  },
  "context": {
    "source": "AuthService",
    "method": "authenticate",
    "line": 45
  },
  "timestamp": 1640995200000,
  "flag": "yellow"
}
```

### 6. Performance Metrics

```json
{
  "type": "performance",
  "message": "Page render performance",
  "metrics": {
    "memory_usage": 45678901,
    "cpu_usage": 65.5,
    "response_time": 250,
    "database_queries": 12,
    "cache_hits": 8,
    "cache_misses": 4
  },
  "breakdown": {
    "database_time": 120,
    "cache_time": 15,
    "template_time": 80,
    "network_time": 35
  },
  "context": {
    "route": "/dashboard",
    "user_id": 123,
    "device_type": "mobile"
  },
  "timestamp": 1640995200000,
  "flag": "blue"
}
```

### 7. Business Events

```json
{
  "type": "event",
  "message": "Order completed successfully",
  "event": "order.completed",
  "entity": "order",
  "entity_id": "ord_123456",
  "actor": {
    "type": "user",
    "id": 123,
    "email": "customer@example.com"
  },
  "data": {
    "order_total": 299.99,
    "items_count": 3,
    "payment_method": "credit_card",
    "shipping_address": "...",
    "discount_applied": 29.99
  },
  "metadata": {
    "source": "web",
    "campaign": "summer_sale",
    "referrer": "google_ads"
  },
  "timestamp": 1640995200000,
  "flag": "green"
}
```

## Framework-Specific Implementation

### PHP/Laravel SDK

```php
<?php

namespace Dumpio\Client;

class DumpioClient
{
    private $host;
    private $port;
    private $socket;
    private $persistent;

    public function __construct(string $host = 'localhost', int $port = 21234, bool $persistent = false)
    {
        $this->host = $host;
        $this->port = $port;
        $this->persistent = $persistent;
        
        if ($persistent) {
            $this->connect();
        }
    }

    public function dump(array $data): void
    {
        $this->ensureConnection();
        
        $payload = array_merge([
            'timestamp' => (int)(microtime(true) * 1000),
            'framework' => 'laravel',
        ], $data);

        $json = json_encode($payload);
        socket_write($this->socket, $json);
        
        if (!$this->persistent) {
            $this->disconnect();
        }
    }

    public function exception(\Throwable $exception, array $context = []): void
    {
        $trace = [];
        foreach ($exception->getTrace() as $frame) {
            $trace[] = [
                'file' => $frame['file'] ?? '',
                'line' => $frame['line'] ?? 0,
                'function' => $frame['function'] ?? '',
                'class' => $frame['class'] ?? null,
                'type' => $frame['type'] ?? null,
            ];
        }

        $this->dump([
            'type' => 'exception',
            'exception' => get_class($exception),
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'code' => $exception->getCode(),
            'trace' => $trace,
            'context' => $this->buildContext($context),
            'flag' => 'red',
        ]);
    }

    public function query(string $sql, array $bindings = [], float $time = null): void
    {
        $this->dump([
            'type' => 'query',
            'message' => 'Database query executed',
            'sql' => $sql,
            'bindings' => $bindings,
            'time' => $time,
            'connection' => config('database.default'),
            'flag' => 'purple',
        ]);
    }

    public function http(string $method, string $url, int $status, array $context = []): void
    {
        $flag = 'blue';
        if ($status >= 400) $flag = 'red';
        elseif ($status >= 300) $flag = 'yellow';
        elseif ($status >= 200) $flag = 'green';

        $this->dump([
            'type' => 'http',
            'message' => "{$method} {$url}",
            'method' => $method,
            'url' => $url,
            'status' => $status,
            'context' => $context,
            'flag' => $flag,
        ]);
    }

    private function buildContext(array $additional = []): array
    {
        $context = [];

        // Request context
        if (app()->bound('request')) {
            $request = request();
            $context['request'] = [
                'url' => $request->fullUrl(),
                'method' => $request->method(),
                'ip' => $request->ip(),
                'userAgent' => $request->userAgent(),
                'headers' => $request->headers->all(),
            ];
        }

        // User context
        if (auth()->check()) {
            $user = auth()->user();
            $context['user'] = [
                'id' => $user->id,
                'email' => $user->email,
            ];
        }

        // Environment
        $context['environment'] = [
            'framework' => 'Laravel',
            'framework_version' => app()->version(),
            'php_version' => PHP_VERSION,
            'environment' => app()->environment(),
            'debug' => config('app.debug'),
        ];

        return array_merge($context, $additional);
    }

    private function ensureConnection(): void
    {
        if (!$this->socket || !is_resource($this->socket)) {
            $this->connect();
        }
    }

    private function connect(): void
    {
        $this->socket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
        if (!socket_connect($this->socket, $this->host, $this->port)) {
            throw new \Exception('Could not connect to Dumpio server');
        }
    }

    private function disconnect(): void
    {
        if ($this->socket && is_resource($this->socket)) {
            socket_close($this->socket);
            $this->socket = null;
        }
    }

    public function __destruct()
    {
        $this->disconnect();
    }
}

// Laravel Service Provider
class DumpioServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->app->singleton(DumpioClient::class, function ($app) {
            return new DumpioClient(
                config('dumpio.host', 'localhost'),
                config('dumpio.port', 21234),
                config('dumpio.persistent', false)
            );
        });
    }

    public function boot()
    {
        // Register exception handler
        $this->app->singleton(
            \Illuminate\Contracts\Debug\ExceptionHandler::class,
            DumpioExceptionHandler::class
        );

        // Register query listener
        DB::listen(function ($query) {
            app(DumpioClient::class)->query(
                $query->sql,
                $query->bindings,
                $query->time
            );
        });
    }
}

// Facade
class Dumpio extends Facade
{
    protected static function getFacadeAccessor()
    {
        return DumpioClient::class;
    }
}

// Usage examples:
// Dumpio::dump(['message' => 'User logged in', 'user_id' => 123]);
// Dumpio::exception($exception);
// Dumpio::query($sql, $bindings, $time);
```

### JavaScript/Node.js SDK

```javascript
const net = require('net');
const util = require('util');

class DumpioClient {
    constructor(options = {}) {
        this.host = options.host || 'localhost';
        this.port = options.port || 21234;
        this.persistent = options.persistent || false;
        this.socket = null;
        this.framework = options.framework || 'node';
    }

    async dump(data) {
        await this.ensureConnection();
        
        const payload = {
            timestamp: Date.now(),
            framework: this.framework,
            ...data
        };

        const json = JSON.stringify(payload);
        
        return new Promise((resolve, reject) => {
            this.socket.write(json, (err) => {
                if (err) reject(err);
                else resolve();
                
                if (!this.persistent) {
                    this.disconnect();
                }
            });
        });
    }

    async exception(error, context = {}) {
        const stack = error.stack ? error.stack.split('\n') : [];
        const trace = this.parseStackTrace(stack);

        await this.dump({
            type: 'exception',
            exception: error.constructor.name,
            message: error.message,
            stack: error.stack,
            trace: trace,
            context: this.buildContext(context),
            flag: 'red'
        });
    }

    async http(req, res, responseTime) {
        let flag = 'blue';
        if (res.statusCode >= 400) flag = 'red';
        else if (res.statusCode >= 300) flag = 'yellow';
        else if (res.statusCode >= 200) flag = 'green';

        await this.dump({
            type: 'http',
            message: `${req.method} ${req.url}`,
            method: req.method,
            url: req.url,
            status: res.statusCode,
            response_time: responseTime,
            headers: req.headers,
            context: {
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
            },
            flag: flag
        });
    }

    async query(sql, bindings = [], time = null) {
        await this.dump({
            type: 'query',
            message: 'Database query executed',
            sql: sql,
            bindings: bindings,
            time: time,
            flag: 'purple'
        });
    }

    parseStackTrace(stackLines) {
        const trace = [];
        
        for (const line of stackLines.slice(1)) { // Skip first line (error message)
            const match = line.match(/\s+at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
            if (match) {
                trace.push({
                    function: match[1],
                    file: match[2],
                    line: parseInt(match[3]),
                    column: parseInt(match[4])
                });
            }
        }
        
        return trace;
    }

    buildContext(additional = {}) {
        const context = {
            environment: {
                node_version: process.version,
                framework: this.framework,
                platform: process.platform,
                arch: process.arch,
                memory: process.memoryUsage()
            }
        };

        return { ...context, ...additional };
    }

    async ensureConnection() {
        if (!this.socket || this.socket.destroyed) {
            await this.connect();
        }
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();
            
            this.socket.connect(this.port, this.host, () => {
                resolve();
            });
            
            this.socket.on('error', (err) => {
                reject(err);
            });
        });
    }

    disconnect() {
        if (this.socket && !this.socket.destroyed) {
            this.socket.destroy();
            this.socket = null;
        }
    }
}

// Express.js middleware
function dumpioMiddleware(client) {
    return (req, res, next) => {
        const start = Date.now();
        
        res.on('finish', () => {
            const responseTime = Date.now() - start;
            client.http(req, res, responseTime).catch(console.error);
        });
        
        next();
    };
}

// Global error handler
function setupGlobalErrorHandler(client) {
    process.on('uncaughtException', (error) => {
        client.exception(error, { type: 'uncaughtException' })
            .catch(console.error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        client.exception(reason, { 
            type: 'unhandledRejection',
            promise: promise
        }).catch(console.error);
    });
}

module.exports = {
    DumpioClient,
    dumpioMiddleware,
    setupGlobalErrorHandler
};

// Usage:
// const { DumpioClient } = require('dumpio-client');
// const dumpio = new DumpioClient({ persistent: true });
// await dumpio.dump({ message: 'User action', user_id: 123 });
```

### Python SDK

```python
import socket
import json
import time
import traceback
import threading
from typing import Dict, Any, Optional, List
from contextlib import contextmanager

class DumpioClient:
    def __init__(self, host: str = 'localhost', port: int = 21234, 
                 persistent: bool = False, framework: str = 'python'):
        self.host = host
        self.port = port
        self.persistent = persistent
        self.framework = framework
        self.socket = None
        self._lock = threading.Lock()

    def dump(self, data: Dict[str, Any]) -> None:
        with self._lock:
            self._ensure_connection()
            
            payload = {
                'timestamp': int(time.time() * 1000),
                'framework': self.framework,
                **data
            }
            
            json_data = json.dumps(payload).encode('utf-8')
            self.socket.send(json_data)
            
            if not self.persistent:
                self.disconnect()

    def exception(self, exc: Exception, context: Optional[Dict[str, Any]] = None) -> None:
        if context is None:
            context = {}
            
        tb = traceback.extract_tb(exc.__traceback__)
        trace = []
        
        for frame in tb:
            trace.append({
                'file': frame.filename,
                'line': frame.lineno,
                'function': frame.name,
                'code': [frame.line] if frame.line else []
            })

        self.dump({
            'type': 'exception',
            'exception': exc.__class__.__name__,
            'message': str(exc),
            'traceback': traceback.format_exc(),
            'trace': trace,
            'context': self._build_context(context),
            'flag': 'red'
        })

    def query(self, sql: str, params: Optional[List] = None, 
              execution_time: Optional[float] = None) -> None:
        self.dump({
            'type': 'query',
            'message': 'Database query executed',
            'sql': sql,
            'bindings': params or [],
            'time': execution_time,
            'flag': 'purple'
        })

    def http(self, method: str, url: str, status: int, 
             response_time: Optional[float] = None, 
             context: Optional[Dict[str, Any]] = None) -> None:
        if status >= 400:
            flag = 'red'
        elif status >= 300:
            flag = 'yellow'
        elif status >= 200:
            flag = 'green'
        else:
            flag = 'blue'

        self.dump({
            'type': 'http',
            'message': f'{method} {url}',
            'method': method,
            'url': url,
            'status': status,
            'response_time': response_time,
            'context': context or {},
            'flag': flag
        })

    def log(self, level: str, message: str, **kwargs) -> None:
        flag_map = {
            'ERROR': 'red',
            'WARNING': 'yellow',
            'INFO': 'blue',
            'DEBUG': 'gray'
        }

        self.dump({
            'type': 'log',
            'message': message,
            'level': level.lower(),
            'details': kwargs,
            'flag': flag_map.get(level.upper(), 'gray')
        })

    def _build_context(self, additional: Dict[str, Any]) -> Dict[str, Any]:
        import sys
        import platform
        
        context = {
            'environment': {
                'python_version': sys.version,
                'framework': self.framework,
                'platform': platform.platform(),
                'architecture': platform.architecture()
            }
        }
        
        return {**context, **additional}

    def _ensure_connection(self) -> None:
        if self.socket is None or self.socket.fileno() == -1:
            self.connect()

    def connect(self) -> None:
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.connect((self.host, self.port))

    def disconnect(self) -> None:
        if self.socket:
            self.socket.close()
            self.socket = None

    def __enter__(self):
        if self.persistent:
            self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()

# Django integration
class DumpioMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.client = DumpioClient(framework='django', persistent=True)

    def __call__(self, request):
        start_time = time.time()
        
        response = self.get_response(request)
        
        response_time = (time.time() - start_time) * 1000
        
        self.client.http(
            method=request.method,
            url=request.get_full_path(),
            status=response.status_code,
            response_time=response_time,
            context={
                'user_id': getattr(request.user, 'id', None),
                'ip': request.META.get('REMOTE_ADDR'),
                'user_agent': request.META.get('HTTP_USER_AGENT')
            }
        )
        
        return response

# Flask integration
from flask import Flask, request, g
import functools

def setup_dumpio_flask(app: Flask, client: DumpioClient):
    @app.before_request
    def before_request():
        g.start_time = time.time()

    @app.after_request
    def after_request(response):
        response_time = (time.time() - g.start_time) * 1000
        
        client.http(
            method=request.method,
            url=request.url,
            status=response.status_code,
            response_time=response_time,
            context={
                'ip': request.remote_addr,
                'user_agent': request.user_agent.string
            }
        )
        
        return response

# Usage examples:
# client = DumpioClient(persistent=True)
# client.dump({'message': 'User action', 'user_id': 123})
# client.exception(exception)
# client.query('SELECT * FROM users', [], 15.5)
```

### Go SDK

```go
package dumpio

import (
    "encoding/json"
    "fmt"
    "net"
    "runtime"
    "sync"
    "time"
)

type Client struct {
    host       string
    port       int
    persistent bool
    framework  string
    conn       net.Conn
    mutex      sync.Mutex
}

type DumpData map[string]interface{}

type StackFrame struct {
    File     string `json:"file"`
    Line     int    `json:"line"`
    Function string `json:"function"`
}

type ExceptionDump struct {
    Type      string       `json:"type"`
    Exception string       `json:"exception"`
    Message   string       `json:"message"`
    File      string       `json:"file,omitempty"`
    Line      int          `json:"line,omitempty"`
    Stack     string       `json:"stack,omitempty"`
    Trace     []StackFrame `json:"trace,omitempty"`
    Context   DumpData     `json:"context,omitempty"`
    Framework string       `json:"framework"`
    Timestamp int64        `json:"timestamp"`
    Flag      string       `json:"flag"`
}

func NewClient(host string, port int, persistent bool, framework string) *Client {
    return &Client{
        host:       host,
        port:       port,
        persistent: persistent,
        framework:  framework,
    }
}

func (c *Client) Dump(data DumpData) error {
    c.mutex.Lock()
    defer c.mutex.Unlock()

    if err := c.ensureConnection(); err != nil {
        return err
    }

    // Add default fields
    data["timestamp"] = time.Now().UnixMilli()
    data["framework"] = c.framework

    jsonData, err := json.Marshal(data)
    if err != nil {
        return err
    }

    _, err = c.conn.Write(jsonData)
    if err != nil {
        return err
    }

    if !c.persistent {
        c.disconnect()
    }

    return nil
}

func (c *Client) Exception(err error, context DumpData) error {
    if context == nil {
        context = make(DumpData)
    }

    // Build stack trace
    trace := make([]StackFrame, 0)
    pc := make([]uintptr, 10)
    n := runtime.Callers(2, pc)
    
    for i := 0; i < n; i++ {
        fn := runtime.FuncForPC(pc[i])
        if fn != nil {
            file, line := fn.FileLine(pc[i])
            trace = append(trace, StackFrame{
                File:     file,
                Line:     line,
                Function: fn.Name(),
            })
        }
    }

    exceptionDump := ExceptionDump{
        Type:      "exception",
        Exception: "error",
        Message:   err.Error(),
        Stack:     fmt.Sprintf("%+v", err),
        Trace:     trace,
        Context:   c.buildContext(context),
        Framework: c.framework,
        Timestamp: time.Now().UnixMilli(),
        Flag:      "red",
    }

    return c.Dump(DumpData(map[string]interface{}{
        "type":      exceptionDump.Type,
        "exception": exceptionDump.Exception,
        "message":   exceptionDump.Message,
        "stack":     exceptionDump.Stack,
        "trace":     exceptionDump.Trace,
        "context":   exceptionDump.Context,
        "framework": exceptionDump.Framework,
        "timestamp": exceptionDump.Timestamp,
        "flag":      exceptionDump.Flag,
    }))
}

func (c *Client) Query(sql string, args []interface{}, duration time.Duration) error {
    return c.Dump(DumpData{
        "type":     "query",
        "message":  "Database query executed",
        "sql":      sql,
        "bindings": args,
        "time":     float64(duration.Nanoseconds()) / 1e6, // Convert to milliseconds
        "flag":     "purple",
    })
}

func (c *Client) HTTP(method, url string, status int, duration time.Duration, context DumpData) error {
    var flag string
    switch {
    case status >= 400:
        flag = "red"
    case status >= 300:
        flag = "yellow"
    case status >= 200:
        flag = "green"
    default:
        flag = "blue"
    }

    return c.Dump(DumpData{
        "type":          "http",
        "message":       fmt.Sprintf("%s %s", method, url),
        "method":        method,
        "url":           url,
        "status":        status,
        "response_time": float64(duration.Nanoseconds()) / 1e6,
        "context":       context,
        "flag":          flag,
    })
}

func (c *Client) Log(level, message string, details DumpData) error {
    flagMap := map[string]string{
        "ERROR":   "red",
        "WARNING": "yellow",
        "INFO":    "blue",
        "DEBUG":   "gray",
    }

    flag, exists := flagMap[level]
    if !exists {
        flag = "gray"
    }

    return c.Dump(DumpData{
        "type":    "log",
        "message": message,
        "level":   level,
        "details": details,
        "flag":    flag,
    })
}

func (c *Client) buildContext(additional DumpData) DumpData {
    context := DumpData{
        "environment": DumpData{
            "go_version": runtime.Version(),
            "framework":  c.framework,
            "goos":       runtime.GOOS,
            "goarch":     runtime.GOARCH,
            "goroutines": runtime.NumGoroutine(),
        },
    }

    // Merge additional context
    for k, v := range additional {
        context[k] = v
    }

    return context
}

func (c *Client) ensureConnection() error {
    if c.conn == nil {
        return c.connect()
    }
    return nil
}

func (c *Client) connect() error {
    conn, err := net.Dial("tcp", fmt.Sprintf("%s:%d", c.host, c.port))
    if err != nil {
        return err
    }
    c.conn = conn
    return nil
}

func (c *Client) disconnect() {
    if c.conn != nil {
        c.conn.Close()
        c.conn = nil
    }
}

func (c *Client) Close() {
    c.mutex.Lock()
    defer c.mutex.Unlock()
    c.disconnect()
}

// Gin middleware
func GinMiddleware(client *Client) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        
        c.Next()
        
        duration := time.Since(start)
        
        client.HTTP(
            c.Request.Method,
            c.Request.URL.Path,
            c.Writer.Status(),
            duration,
            DumpData{
                "ip":         c.ClientIP(),
                "user_agent": c.Request.UserAgent(),
                "query":      c.Request.URL.RawQuery,
            },
        )
    }
}

// Echo middleware
func EchoMiddleware(client *Client) echo.MiddlewareFunc {
    return func(next echo.HandlerFunc) echo.HandlerFunc {
        return func(c echo.Context) error {
            start := time.Now()
            
            err := next(c)
            
            duration := time.Since(start)
            status := c.Response().Status
            
            if err != nil {
                // Handle error case
                client.Exception(err, DumpData{
                    "method": c.Request().Method,
                    "url":    c.Request().URL.Path,
                })
            }
            
            client.HTTP(
                c.Request().Method,
                c.Request().URL.Path,
                status,
                duration,
                DumpData{
                    "ip":         c.RealIP(),
                    "user_agent": c.Request().UserAgent(),
                },
            )
            
            return err
        }
    }
}

// Usage examples:
// client := dumpio.NewClient("localhost", 21234, true, "gin")
// client.Dump(dumpio.DumpData{"message": "User action", "user_id": 123})
// client.Exception(err, dumpio.DumpData{"context": "user_service"})
// client.Query("SELECT * FROM users", []interface{}{}, time.Millisecond*15)
```

## SDK Architecture

### Core SDK Components

```typescript
interface SDK {
    // Core functionality
    dump(data: object): Promise<void>
    exception(error: Error, context?: object): Promise<void>
    
    // Specialized methods
    query(sql: string, bindings?: any[], time?: number): Promise<void>
    http(method: string, url: string, status: number, context?: object): Promise<void>
    log(level: string, message: string, details?: object): Promise<void>
    
    // Connection management
    connect(): Promise<void>
    disconnect(): Promise<void>
    
    // Configuration
    configure(options: SDKOptions): void
}

interface SDKOptions {
    host?: string
    port?: number
    persistent?: boolean
    framework?: string
    timeout?: number
    retries?: number
    bufferSize?: number
}
```

### Advanced Features

#### 1. Buffering & Batching
```typescript
class BufferedDumpioClient {
    private buffer: object[] = []
    private maxBufferSize = 100
    private flushInterval = 5000 // 5 seconds
    
    async dump(data: object): Promise<void> {
        this.buffer.push(data)
        
        if (this.buffer.length >= this.maxBufferSize) {
            await this.flush()
        }
    }
    
    private async flush(): Promise<void> {
        if (this.buffer.length === 0) return
        
        const batch = this.buffer.splice(0)
        await this.sendBatch(batch)
    }
    
    private async sendBatch(items: object[]): Promise<void> {
        const batchMessage = {
            type: 'batch',
            items: items,
            count: items.length,
            timestamp: Date.now()
        }
        
        await this.send(batchMessage)
    }
}
```

#### 2. Error Recovery
```typescript
class ResilientDumpioClient {
    private retryCount = 3
    private retryDelay = 1000
    
    async dump(data: object): Promise<void> {
        for (let attempt = 1; attempt <= this.retryCount; attempt++) {
            try {
                await this.send(data)
                return
            } catch (error) {
                if (attempt === this.retryCount) {
                    this.handleFailure(data, error)
                    throw error
                }
                
                await this.delay(this.retryDelay * attempt)
            }
        }
    }
    
    private handleFailure(data: object, error: Error): void {
        // Log to local file, queue for later, etc.
        console.error('Failed to send dump after retries:', error)
    }
    
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
```

#### 3. Async Queue
```typescript
class QueuedDumpioClient {
    private queue: Array<() => Promise<void>> = []
    private processing = false
    
    async dump(data: object): Promise<void> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    await this.send(data)
                    resolve()
                } catch (error) {
                    reject(error)
                }
            })
            
            this.processQueue()
        })
    }
    
    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) return
        
        this.processing = true
        
        while (this.queue.length > 0) {
            const task = this.queue.shift()
            if (task) {
                try {
                    await task()
                } catch (error) {
                    console.error('Queue task failed:', error)
                }
            }
        }
        
        this.processing = false
    }
}
```

## Error Handling

### Connection Errors

```typescript
// Handle connection failures gracefully
class DumpioClient {
    async send(data: object): Promise<void> {
        try {
            await this.ensureConnection()
            await this.socket.write(JSON.stringify(data))
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                // Dumpio server not running
                this.handleServerDown(data)
            } else if (error.code === 'ECONNRESET') {
                // Connection lost, retry
                this.reconnectAndRetry(data)
            } else {
                // Other errors
                this.handleUnknownError(error, data)
            }
        }
    }
    
    private handleServerDown(data: object): void {
        // Options:
        // 1. Queue for later
        // 2. Log to file
        // 3. Send to alternative endpoint
        // 4. Fail silently (development)
        
        if (this.isDevelopment()) {
            console.warn('Dumpio server not available, data discarded')
        } else {
            this.queueForLater(data)
        }
    }
}
```

### Data Validation

```typescript
interface DataValidator {
    validate(data: object): ValidationResult
}

interface ValidationResult {
    valid: boolean
    errors: string[]
    warnings: string[]
}

class DumpioValidator implements DataValidator {
    validate(data: object): ValidationResult {
        const errors: string[] = []
        const warnings: string[] = []
        
        // Required fields
        if (!data.message) {
            errors.push('message field is required')
        }
        
        // Size limits
        const size = JSON.stringify(data).length
        if (size > 1024 * 1024) { // 1MB
            errors.push('payload too large (max 1MB)')
        } else if (size > 100 * 1024) { // 100KB
            warnings.push('large payload detected')
        }
        
        // Type validation
        if (data.timestamp && typeof data.timestamp !== 'number') {
            errors.push('timestamp must be a number')
        }
        
        if (data.flag && !['red', 'yellow', 'blue', 'gray', 'purple', 'pink', 'green'].includes(data.flag)) {
            warnings.push('unknown flag color')
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        }
    }
}
```

## Performance Guidelines

### Connection Management

1. **Use Persistent Connections** for high-frequency dumps
2. **Connection Pooling** for multi-threaded applications
3. **Proper Cleanup** to prevent resource leaks

### Data Optimization

```typescript
// Efficient data serialization
class OptimizedDumpioClient {
    private serializationCache = new Map<string, string>()
    
    async dump(data: object): Promise<void> {
        // Cache common structures
        const cacheKey = this.getCacheKey(data)
        let json = this.serializationCache.get(cacheKey)
        
        if (!json) {
            json = JSON.stringify(data)
            
            // Limit cache size
            if (this.serializationCache.size > 100) {
                this.serializationCache.clear()
            }
            
            this.serializationCache.set(cacheKey, json)
        }
        
        await this.send(json)
    }
    
    private getCacheKey(data: object): string {
        // Create key based on data structure
        return JSON.stringify(Object.keys(data).sort())
    }
}
```

### Memory Management

```typescript
// Prevent memory leaks
class MemoryEfficientClient {
    private messageQueue: object[] = []
    private maxQueueSize = 1000
    
    async dump(data: object): Promise<void> {
        // Limit queue size
        if (this.messageQueue.length >= this.maxQueueSize) {
            this.messageQueue.shift() // Remove oldest
        }
        
        this.messageQueue.push(data)
        
        // Process queue
        await this.processQueue()
    }
    
    // Cleanup circular references
    private sanitizeData(data: any): any {
        const seen = new WeakSet()
        
        return JSON.parse(JSON.stringify(data, (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                    return '[Circular]'
                }
                seen.add(value)
            }
            return value
        }))
    }
}
```

## Testing & Validation

### Test Server

```bash
# Simple test server for validation
const net = require('net')

const server = net.createServer((socket) => {
    console.log('Client connected')
    
    socket.on('data', (data) => {
        try {
            const json = JSON.parse(data.toString())
            console.log('Received:', JSON.stringify(json, null, 2))
            
            // Validate required fields
            if (!json.message) {
                console.error('Missing required field: message')
            }
        } catch (error) {
            console.error('Invalid JSON:', error.message)
        }
    })
    
    socket.on('close', () => {
        console.log('Client disconnected')
    })
})

server.listen(21234, () => {
    console.log('Test server listening on port 21234')
})
```

### Validation Tests

```typescript
// Test data formats
const testCases = [
    // Basic dump
    {
        message: 'Test basic dump',
        timestamp: Date.now(),
        flag: 'blue'
    },
    
    // Exception
    {
        type: 'exception',
        exception: 'Error',
        message: 'Test error',
        file: 'test.js',
        line: 10,
        flag: 'red'
    },
    
    // SQL Query
    {
        type: 'query',
        sql: 'SELECT * FROM users WHERE id = ?',
        bindings: [123],
        time: 15.5,
        flag: 'purple'
    },
    
    // HTTP Request
    {
        type: 'http',
        method: 'GET',
        url: '/api/users',
        status: 200,
        response_time: 120,
        flag: 'green'
    }
]

// Send test data
async function runTests() {
    const client = new DumpioClient()
    
    for (const testCase of testCases) {
        try {
            await client.dump(testCase)
            console.log('✓ Test passed:', testCase.type || 'basic')
        } catch (error) {
            console.error('✗ Test failed:', error.message)
        }
    }
    
    await client.disconnect()
}
```

## Reference Implementations

### Complete PHP Package

```php
// composer.json
{
    "name": "dumpio/client",
    "description": "PHP client for Dumpio TCP dump viewer",
    "require": {
        "php": "^8.0"
    },
    "autoload": {
        "psr-4": {
            "Dumpio\\": "src/"
        }
    }
}

// src/DumpioClient.php
<?php
namespace Dumpio;

class DumpioClient {
    // Implementation as shown above
}

// src/Laravel/DumpioServiceProvider.php
// src/Laravel/DumpioFacade.php
// src/Middleware/DumpioMiddleware.php
```

### Complete Node.js Package

```json
// package.json
{
  "name": "dumpio-client",
  "version": "1.0.0",
  "description": "Node.js client for Dumpio TCP dump viewer",
  "main": "index.js",
  "types": "index.d.ts",
  "scripts": {
    "test": "jest",
    "build": "tsc"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^18.0.0",
    "typescript": "^4.8.0",
    "jest": "^29.0.0"
  }
}

// index.js - Main implementation
// index.d.ts - TypeScript definitions
// middleware/ - Express, Fastify, Koa middleware
// test/ - Test suites
```

### Complete Python Package

```python
# setup.py
from setuptools import setup, find_packages

setup(
    name='dumpio-client',
    version='1.0.0',
    description='Python client for Dumpio TCP dump viewer',
    packages=find_packages(),
    install_requires=[],
    extras_require={
        'django': ['django>=3.0'],
        'flask': ['flask>=2.0'],
        'fastapi': ['fastapi>=0.68.0']
    },
    python_requires='>=3.8'
)

# dumpio_client/
#   __init__.py
#   client.py
#   django/
#     middleware.py
#     handlers.py
#   flask/
#     extensions.py
#   fastapi/
#     middleware.py
```

### Complete Go Module

```go
// go.mod
module github.com/dumpio/go-client

go 1.19

require (
    github.com/gin-gonic/gin v1.9.0
    github.com/labstack/echo/v4 v4.10.0
)

// Directory structure:
// dumpio/
//   client.go
//   middleware/
//     gin.go
//     echo.go
//   examples/
//     basic/
//     gin/
//     echo/
```

This comprehensive documentation provides everything needed to create robust, production-ready SDK libraries for any programming language or framework. Each implementation should follow these patterns while adapting to language-specific conventions and best practices.
                '