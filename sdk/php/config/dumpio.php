<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Dumpio client configuration
|--------------------------------------------------------------------------
|
| Publish with:  php artisan vendor:publish --tag=dumpio-config
|
| All values fall back to the matching DUMPIO_* environment variable so the
| package works with zero config when a Dumpio viewer is running locally.
|
*/

return [
    // Host the Dumpio viewer is listening on.
    'host' => env('DUMPIO_HOST', 'localhost'),

    // Port the Dumpio viewer is listening on.
    'port' => (int) env('DUMPIO_PORT', 21234),

    // Shared token, if the viewer has one configured.
    'token' => env('DUMPIO_TOKEN', ''),

    // Master switch. Defaults to on outside production; never sends in
    // production unless you flip DUMPIO_ENABLED=true explicitly.
    'enabled' => env('DUMPIO_ENABLED', env('APP_DEBUG', false)),

    // Automatically forward every database query as a `query` dump.
    'listen_queries' => env('DUMPIO_LISTEN_QUERIES', false),

    // Automatically forward reported exceptions as `exception` dumps.
    'listen_exceptions' => env('DUMPIO_LISTEN_EXCEPTIONS', false),

    // Route the framework's dump()/dd() helpers into the Dumpio viewer instead
    // of rendering them inline (uses Symfony VarDumper::setHandler).
    'intercept_dumps' => env('DUMPIO_INTERCEPT_DUMPS', false),

    // Forward Eloquent model lifecycle events (created/updated/deleted/restored)
    // as `model` dumps.
    'listen_models' => env('DUMPIO_LISTEN_MODELS', false),

    // Forward cache events (hit/missed/written/forgotten) as `event` dumps.
    'listen_cache' => env('DUMPIO_LISTEN_CACHE', false),

    // Forward queued-job lifecycle (processing/processed/failed) as `event` dumps.
    'listen_jobs' => env('DUMPIO_LISTEN_JOBS', false),

    // Forward application (non-framework) events as `event` dumps. Best-effort:
    // framework-internal events are filtered out to avoid a firehose.
    'listen_events' => env('DUMPIO_LISTEN_EVENTS', false),

    // Register chainable ->dio() / ->ddio() macros on query builders and
    // collections. No cost unless you actually call them.
    'register_macros' => env('DUMPIO_REGISTER_MACROS', true),
];
