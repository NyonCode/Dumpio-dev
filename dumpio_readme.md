# Dumpio

A professional TCP-based dump viewer application for real-time monitoring and analysis of data from various frameworks and languages.

![Dumpio Screenshot](https://via.placeholder.com/800x500/1e293b/ffffff?text=Dumpio+Interface)

## 🚀 Features

- **🌐 Multi-Framework Support**: Laravel, Symfony, Node.js, React, Vue, Alpine.js, Python (Django, Flask, FastAPI), Go (Gin, Echo)
- **📡 Real-time TCP Monitoring**: Multiple concurrent TCP servers with configurable ports
- **🔍 Advanced Exception Parsing**: Intelligent stack trace analysis with solution suggestions
- **🎨 Professional UI**: Modern dark/light theme with responsive design
- **💾 Data Persistence**: Configurable auto-save and session restoration
- **📤 Export Capabilities**: JSON export with comprehensive metadata
- **⚡ Performance Optimized**: Memory-efficient with configurable limits
- **🔧 IDE Integration**: Direct file opening support (VS Code, JetBrains, custom)

## 📦 Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd dumpio

# Install dependencies
npm install

# Start development server
npm run dev
```

### Download Releases

Download the latest release for your platform:

- [Windows](https://github.com/your-repo/dumpio/releases/latest) - `.exe` installer
- [macOS](https://github.com/your-repo/dumpio/releases/latest) - `.dmg` package
- [Linux](https://github.com/your-repo/dumpio/releases/latest) - `.AppImage` / `.deb`

## 🚀 Quick Usage

### 1. Configure TCP Server

1. Open Dumpio
2. Go to **Settings** → **Servers**
3. Add a new server:
   - **Name**: Development Server
   - **Host**: localhost
   - **Port**: 21234
   - **Active**: ✅

### 2. Send Data

#### Simple Data Dump
```bash
echo '{"message": "User logged in", "user_id": 123, "flag": "green"}' | nc localhost 21234
```

#### Exception Data
```bash
echo '{
  "type": "exception",
  "exception": "Illuminate\\Database\\QueryException",
  "message": "SQLSTATE[42S02]: Base table not found",
  "file": "/app/Models/User.php",
  "line": 45,
  "trace": [...]
}' | nc localhost 21234
```

#### SQL Query
```bash
echo '{
  "type": "query",
  "sql": "SELECT * FROM users WHERE active = ?",
  "bindings": [true],
  "time": 15.5
}' | nc localhost 21234
```

### 3. View Real-time Data

Data appears instantly in the Dumpio interface with:
- Color-coded flags
- Type detection (SQL, Exception, HTTP, Log)
- Expandable JSON viewer
- Exception stack traces with solutions

## 📋 Data Formats

### Basic Dump
```json
{
  "message": "User action performed",
  "timestamp": 1640995200000,
  "flag": "blue",
  "channel": "auth",
  "user_id": 123,
  "metadata": {
    "ip": "192.168.1.100",
    "browser": "Chrome"
  }
}
```

### Exception Format
```json
{
  "type": "exception",
  "exception": "TypeError",
  "message": "Cannot read property 'name' of undefined",
  "file": "/src/components/User.jsx",
  "line": 45,
  "stack": "TypeError: Cannot read property...",
  "context": {
    "component": "UserProfile",
    "props": {...}
  }
}
```

### SQL Query Format
```json
{
  "type": "query",
  "sql": "SELECT * FROM users WHERE email = ?",
  "bindings": ["user@example.com"],
  "time": 12.3,
  "connection": "mysql"
}
```

## 🎨 Features Overview

### Exception Analysis
- **Smart Stack Trace Parsing** for 10+ frameworks
- **Automatic Solution Suggestions** with confidence ratings
- **Code Context Display** with highlighted error lines
- **Framework-Specific Error Handling**

### Data Visualization
- **Professional JSON Viewer** with syntax highlighting
- **Type Detection** (SQL, HTTP, Exceptions, Logs)
- **Expandable Objects** with smart formatting
- **Performance Metrics** (query time, memory usage)

### Filtering & Search
- **Server-based Filtering** - View specific servers
- **Flag-based Filtering** - Filter by color categories
- **Text Search** - Search within payload data
- **Real-time Updates** - Live filtering as data arrives

### Flag System
Organize your dumps with color-coded flags:

- 🔴 **Red**: Errors, exceptions, critical issues
- 🟡 **Yellow**: Warnings, deprecated features  
- 🔵 **Blue**: Information, general data
- 🟢 **Green**: Success operations
- 🟣 **Purple**: Database queries
- 🩷 **Pink**: User interactions
- ⚫ **Gray**: Default/uncategorized

## ⚙️ Configuration

### Server Settings
```typescript
{
  "id": "dev-server",
  "name": "Development Server",
  "host": "localhost",
  "port": 21234,
  "color": "blue",
  "active": true
}
```

### Application Settings
```typescript
{
  "theme": "dark",                    // light, dark, system
  "saveDumpsOnExit": true,           // Persist dumps
  "autoSaveDumps": true,             // Auto-save every 5s
  "maxDumpsInMemory": 1000,          // Memory limit
  "viewMode": "detailed",            // detailed, compact
  "viewerMode": "professional"       // professional, simple
}
```

## 🔧 Framework Integration

### Laravel
```php
// Add to your application
collect(['user_id' => 123, 'action' => 'login'])
    ->put('flag', 'green')
    ->put('timestamp', now()->timestamp)
    ->pipe(function($data) {
        $socket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
        socket_connect($socket, 'localhost', 21234);
        socket_write($socket, json_encode($data));
        socket_close($socket);
    });
```

### Node.js
```javascript
const net = require('net');

function sendDump(data) {
  const client = new net.Socket();
  client.connect(21234, 'localhost', () => {
    client.write(JSON.stringify({
      ...data,
      timestamp: Date.now(),
      flag: 'blue'
    }));
    client.destroy();
  });
}

// Usage
sendDump({ message: 'User action', user_id: 123 });
```

### Python
```python
import socket
import json
import time

def send_dump(data):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect(('localhost', 21234))
    
    payload = {
        **data,
        'timestamp': int(time.time() * 1000),
        'flag': 'blue'
    }
    
    sock.send(json.dumps(payload).encode())
    sock.close()

# Usage
send_dump({'message': 'User action', 'user_id': 123})
```

### Go
```go
package main

import (
    "encoding/json"
    "net"
    "time"
)

func SendDump(data map[string]interface{}) error {
    conn, err := net.Dial("tcp", "localhost:21234")
    if err != nil {
        return err
    }
    defer conn.Close()
    
    data["timestamp"] = time.Now().UnixMilli()
    data["flag"] = "blue"
    
    jsonData, _ := json.Marshal(data)
    _, err = conn.Write(jsonData)
    return err
}
```

## 🔧 Development

### Build Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run build:win    # Build for Windows
npm run build:mac    # Build for macOS  
npm run build:linux  # Build for Linux
npm run lint         # Run ESLint
npm run format       # Format with Prettier
```

### Project Structure
```
src/
├── main/                    # Electron main process
│   ├── index.ts            # App entry point
│   ├── tcp-server.ts       # TCP server implementation
│   ├── dump-manager.ts     # Data management
│   └── settings-manager.ts # Configuration
├── preload/                # Electron preload
│   └── index.ts           # IPC bridge
└── renderer/              # React frontend
    ├── src/
    │   ├── App.tsx        # Main component
    │   ├── components/    # UI components
    │   ├── contexts/      # React contexts
    │   └── utils/         # Utilities
    └── index.html
```

### Tech Stack
- **Electron** - Cross-platform desktop framework
- **React 19** - UI framework with modern hooks
- **TypeScript** - Type safety and better DX
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast build tool
- **TCP/IP** - Reliable network protocol

## 🐛 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
Error: Port 21234 is already in use
```
*Solution: Change port in settings or stop conflicting service*

**JSON Parse Errors**
```bash
Failed to parse JSON: Unexpected token
```
*Solution: Ensure valid JSON format in your applications*

**Memory Issues**
```bash
Application becoming slow
```
*Solution: Reduce maxDumpsInMemory or enable auto-save*

### Debug Mode
```bash
# Enable debug logging
NODE_ENV=development npm run dev
```

### Test Data
```bash
# Send test dump
echo '{"message": "Test", "flag": "blue"}' | nc localhost 21234

# Send test exception
echo '{
  "type": "exception",
  "exception": "Error", 
  "message": "Test error",
  "file": "test.js",
  "line": 10
}' | nc localhost 21234
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 💬 Support

- 📧 Email: support@dumpio.dev
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/dumpio/issues)
- 📖 Documentation: [Full Documentation](https://docs.dumpio.dev)

## ⭐ Show Your Support

If you find this project helpful, please consider giving it a star on GitHub!

---

**Made with ❤️ by the Dumpio Team**