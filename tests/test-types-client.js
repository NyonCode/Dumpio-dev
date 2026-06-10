// Manual smoke test for the rich Ray-style payload types (PLAN-VIEWER C3).
//
// Run the app, then:  node tests/test-types-client.js
//
// Sends one dump of each structured type so you can eyeball the dedicated
// renderers: performance (metric cards + breakdown bars), event (actor + data),
// model (attributes table + relations), collection (auto table), table
// (columns/rows) and measure (big threshold-colored timing).

const { sendDump, PROTOCOL } = require('./send')

const opts = { host: 'localhost', port: 21234 }

async function send(label, data) {
  await sendDump(data, opts)
  console.log(`✅ Sent ${label} (${PROTOCOL})`)
}

async function main() {
  await send('performance', {
    type: 'performance',
    message: 'Page render performance',
    flag: 'blue',
    metrics: {
      memory_usage: 45678901,
      cpu_usage: 65.5,
      response_time: 250,
      database_queries: 12,
      cache_hits: 8,
      cache_misses: 4
    },
    breakdown: { database_time: 120, cache_time: 15, template_time: 80, network_time: 35 },
    context: { route: '/dashboard', user_id: 123, device_type: 'mobile' }
  })

  await send('event', {
    type: 'event',
    message: 'Order completed successfully',
    event: 'order.completed',
    entity: 'order',
    entity_id: 'ord_123456',
    flag: 'green',
    actor: { type: 'user', id: 123, email: 'customer@example.com' },
    data: { order_total: 299.99, items_count: 3, payment_method: 'credit_card' },
    metadata: { source: 'web', campaign: 'summer_sale' }
  })

  await send('model', {
    type: 'model',
    class: 'App\\Models\\User',
    exists: true,
    connection: 'mysql',
    flag: 'purple',
    attributes: {
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      settings: { theme: 'dark', notifications: true }
    },
    relations: { posts: [{ id: 10, title: 'Hello' }], role: { id: 1, name: 'admin' } }
  })

  await send('collection', {
    type: 'collection',
    count: 3,
    items: [
      { id: 1, name: 'Ada', role: 'admin' },
      { id: 2, name: 'Linus', role: 'user' },
      { id: 3, name: 'Grace', role: 'user' }
    ]
  })

  await send('table', {
    type: 'table',
    columns: ['id', 'name', 'role'],
    rows: [
      [1, 'Ada', 'admin'],
      [2, 'Linus', 'user']
    ]
  })

  await send('measure (slow)', {
    type: 'measure',
    name: 'render dashboard',
    time: 1280.4,
    memory: 2097152,
    flag: 'red',
    context: { route: '/dashboard' }
  })

  console.log('\nSent 6 structured dumps. Use the type filter to inspect each renderer.')
}

main().catch((err) => {
  console.error('Failed to send dumps:', err.message)
  process.exit(1)
})
