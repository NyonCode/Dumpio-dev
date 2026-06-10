// Manual smoke test for the unified `var` value tree (PLAN-VIEWER C1).
//
// Run the app, then:  node tests/test-var-client.js
//
// Sends several `var` dumps via the reference Node SDK so you can eyeball the
// receiver classifying them as "Var Dump": nested objects, class instances,
// Map/Set, cycles, special numbers, and a deep tree that gets truncated.

const { dumpio, configure } = require('../sdk/node')

configure({ host: 'localhost', port: 21234 })

class User {
  constructor() {
    this.id = 42
    this.name = 'Ada Lovelace'
    this.roles = ['admin', 'engineer']
    this._internalToken = 'shhh'
  }
}

async function main() {
  await dumpio({ hello: 'world', n: 7, pi: 3.14159, ok: true, nope: null }, { label: 'primitives' })

  const user = new User()
  await dumpio(user, { label: 'User instance', flag: 'green' })

  const cyclic = { name: 'node-a' }
  cyclic.self = cyclic
  cyclic.peer = { name: 'node-b', back: cyclic }
  await dumpio(cyclic, { label: 'cyclic graph', flag: 'purple' })

  await dumpio(
    {
      map: new Map([
        ['k1', 1],
        ['k2', { nested: true }]
      ]),
      set: new Set([1, 2, 3]),
      when: new Date(),
      rx: /ab+c/gi,
      big: 9007199254740993n,
      nan: NaN,
      inf: Infinity
    },
    { label: 'rich types', flag: 'yellow' }
  )

  // Deep nesting → exercises the depth limit / truncation.
  let deep = { level: 0 }
  let cursor = deep
  for (let i = 1; i <= 10; i++) {
    cursor.child = { level: i }
    cursor = cursor.child
  }
  await dumpio(deep, { label: 'deep tree (truncated)', flag: 'red' })

  console.log('Sent 5 var dumps to http://localhost:21234/dumps')
}

main().catch((err) => {
  console.error('Failed to send dumps:', err.message)
  process.exit(1)
})
