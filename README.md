# Dumpio

Real-time TCP/HTTP receiver and viewer for JSON debug dumps (Laravel, Node, Python, Go, …).

## Sending dumps

Dumpio listens locally (loopback only by default). Each configured server is either **HTTP** (recommended) or **TCP** (legacy).

### HTTP (recommended)

```bash
# single dump
curl -X POST http://127.0.0.1:21234/dumps \
  -H 'Content-Type: application/json' \
  -d '{"message":"hello","flag":"green"}'

# batch
curl -X POST http://127.0.0.1:21234/dumps \
  -H 'Content-Type: application/json' \
  -d '[{"message":"a"},{"message":"b"}]'

# health check
curl http://127.0.0.1:21234/health
```

If an access token is configured (Settings → Security), include it:
`-H 'Authorization: Bearer <token>'` (or `-H 'X-Dumpio-Token: <token>'`).

### TCP (legacy)

```bash
echo '{"message":"hi","flag":"green"}' | nc localhost 21234
```

### Dump fields

`message`/`title`, `flag` (`red|yellow|blue|gray|purple|pink|green`), `channel`, plus any
custom JSON payload. Exceptions/stack traces are detected and rendered specially.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
