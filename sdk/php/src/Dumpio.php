<?php

declare(strict_types=1);

namespace Dumpio;

/**
 * dumpio/client (PHP) — send faithful, typed value dumps to the Dumpio app.
 *
 *   Dumpio::dump($user, 'user', 'blue');
 *   Dumpio::dd($a, $b);                 // dump and die
 *   Dumpio::exception($e);              // structured error + stack trace
 *   Dumpio::query($sql, $bindings);     // SQL query
 *   Dumpio::http('GET', '/users', 200); // HTTP request/response
 *
 * Transport is HTTP-first (POST /dumps), fire-and-forget. A debugging helper
 * must never break the host app, so every public method swallows its errors and
 * the transport silently drops on failure.
 *
 * Configuration is read from the environment on first use and may be overridden
 * with {@see Dumpio::configure()}:
 *
 *   DUMPIO_HOST   (default "localhost")
 *   DUMPIO_PORT   (default 21234)
 *   DUMPIO_TOKEN  (default "")
 *   DUMPIO_DISABLE (any non-empty value disables the client)
 */
final class Dumpio
{
    /** @var array<string,mixed>|null lazily seeded from the environment */
    private static ?array $config = null;

    /**
     * The default configuration, merged with environment overrides on first use.
     *
     * @return array<string,mixed>
     */
    private static function defaults(): array
    {
        $port = \getenv('DUMPIO_PORT');

        return [
            'host' => self::envString('DUMPIO_HOST', 'localhost'),
            'port' => ($port !== false && \is_numeric($port)) ? (int) $port : 21234,
            'path' => '/dumps',
            'token' => self::envString('DUMPIO_TOKEN', ''),
            'timeoutMs' => 1500,
            'enabled' => \getenv('DUMPIO_DISABLE') === false || \getenv('DUMPIO_DISABLE') === '',
            'maxDepth' => 6,
            'maxItems' => 100,
            'maxString' => 2000,
        ];
    }

    /**
     * Read a string environment variable with a fallback.
     */
    private static function envString(string $name, string $default): string
    {
        $value = \getenv($name);

        return ($value === false || $value === '') ? $default : $value;
    }

    /**
     * @return array<string,mixed>
     */
    private static function config(): array
    {
        if (self::$config === null) {
            self::$config = self::defaults();
        }

        return self::$config;
    }

    /**
     * Override one or more configuration values.
     *
     * @param array<string,mixed> $options
     */
    public static function configure(array $options): void
    {
        self::$config = \array_merge(self::config(), $options);
    }

    // ------------------------------------------------------------------
    // var dump (the flagship)
    // ------------------------------------------------------------------

    /**
     * Send one value as a `var` dump.
     */
    public static function dump(mixed $value, ?string $label = null, string $flag = 'blue', string $channel = 'default'): void
    {
        self::dumpVar($value, $label, $flag, $channel, null);
    }

    /**
     * Begin a fluent dump: `Dumpio::make($x)->red()->label('user')->channel('auth')`.
     * The dump is shipped on {@see PendingDump::send()} or automatically when the
     * builder goes out of scope, so the trailing `->send()` is optional.
     */
    public static function make(mixed $value): PendingDump
    {
        return new PendingDump($value, self::caller());
    }

    /**
     * Ship a `var` dump with an explicit caller and optional extra envelope
     * fields (e.g. `dedupeKey`/`count` for the aggregating helpers). Used by
     * {@see PendingDump}; prefer {@see dump()} or {@see make()} in app code.
     *
     * @internal
     *
     * @param array<string,mixed>|null $caller file/line/function, or null to detect
     * @param array<string,mixed>      $extra  additional payload fields (null values skipped)
     */
    public static function dumpVar(
        mixed $value,
        ?string $label,
        string $flag,
        string $channel,
        ?array $caller,
        array $extra = []
    ): void {
        try {
            $config = self::config();
            $serializer = new Serializer(
                (int) $config['maxDepth'],
                (int) $config['maxItems'],
                (int) $config['maxString']
            );

            $payload = [
                'type' => 'var',
                'language' => 'php',
                'label' => $label,
                'message' => $label,
                'caller' => $caller ?? self::caller(),
                'value' => $serializer->serialize($value),
            ];
            foreach ($extra as $key => $val) {
                if ($val !== null) {
                    $payload[$key] = $val;
                }
            }

            self::emit($payload, ['flag' => $flag, 'channel' => $channel]);
        } catch (\Throwable) {
            // A debug helper must never break the host app.
        }
    }

    /**
     * Dump every argument, then stop execution ("dump & die").
     */
    public static function dd(mixed ...$values): never
    {
        foreach ($values as $value) {
            self::dump($value);
        }

        exit(1);
    }

    // ------------------------------------------------------------------
    // Typed message helpers (§3 of BUILDING.md)
    // ------------------------------------------------------------------

    /**
     * Report a Throwable with a structured stack trace and optional context.
     *
     * @param array<string,mixed> $context contextual data (request/user/database/…)
     * @param array<string,mixed> $opts    envelope overrides (flag/channel/origin/framework)
     */
    public static function exception(\Throwable $e, array $context = [], array $opts = []): void
    {
        try {
            $payload = [
                'type' => 'exception',
                'framework' => $opts['framework'] ?? 'php',
                'exception' => \get_class($e),
                'message' => $e->getMessage() !== '' ? $e->getMessage() : \get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'code' => $e->getCode(),
                'trace' => self::trace($e),
            ];

            if ($context !== []) {
                $payload['context'] = $context;
            }

            unset($opts['framework']);
            self::emit($payload, $opts + ['flag' => 'red']);
        } catch (\Throwable) {
            // never break the host app
        }
    }

    /**
     * Report a database query.
     *
     * @param array<int|string,mixed> $bindings parameter bindings
     * @param float|null               $timeMs   execution time in milliseconds
     * @param array<string,mixed>      $opts     envelope overrides (+ optional `connection`)
     */
    public static function query(string $sql, array $bindings = [], ?float $timeMs = null, array $opts = []): void
    {
        try {
            $payload = [
                'type' => 'query',
                'message' => self::truncate($sql, 200),
                'sql' => $sql,
                'bindings' => $bindings,
            ];
            if ($timeMs !== null) {
                $payload['time'] = $timeMs;
            }
            if (isset($opts['connection'])) {
                $payload['connection'] = $opts['connection'];
                unset($opts['connection']);
            }

            self::emit($payload, $opts + ['flag' => 'purple']);
        } catch (\Throwable) {
            // never break the host app
        }
    }

    /**
     * Report an HTTP request/response.
     *
     * Recognised $opts keys: `headers`, `body`, `responseTime` (ms), plus the
     * usual envelope overrides (flag/channel/origin).
     *
     * @param array<string,mixed> $opts
     */
    public static function http(string $method, string $url, ?int $status = null, array $opts = []): void
    {
        try {
            $method = \strtoupper($method);
            $payload = [
                'type' => 'http',
                'message' => \trim($method.' '.$url),
                'method' => $method,
                'url' => $url,
            ];
            if ($status !== null) {
                $payload['status'] = $status;
            }
            if (isset($opts['headers'])) {
                $payload['headers'] = $opts['headers'];
            }
            if (isset($opts['body'])) {
                $payload['body'] = $opts['body'];
            }
            if (isset($opts['responseTime'])) {
                $payload['response_time'] = $opts['responseTime'];
            }
            unset($opts['headers'], $opts['body'], $opts['responseTime']);

            self::emit($payload, $opts + ['flag' => self::flagForStatus($status)]);
        } catch (\Throwable) {
            // never break the host app
        }
    }

    /**
     * Report a log line.
     *
     * @param array<string,mixed> $details
     * @param array<string,mixed> $opts    envelope overrides (flag/channel/origin)
     */
    public static function log(string $level, string $message, array $details = [], array $opts = []): void
    {
        try {
            $payload = [
                'type' => 'log',
                'level' => $level,
                'message' => $message,
            ];
            if ($details !== []) {
                $payload['details'] = $details;
            }

            self::emit($payload, $opts + ['flag' => self::flagForLevel($level)]);
        } catch (\Throwable) {
            // never break the host app
        }
    }

    /**
     * Report a single domain object (Eloquent / Django / Prisma / struct).
     *
     * Recognised $opts keys: `relations`, `exists`, `connection`, plus the usual
     * envelope overrides.
     *
     * @param array<string,mixed> $attributes
     * @param array<string,mixed> $opts
     */
    public static function model(string $class, array $attributes, array $opts = []): void
    {
        try {
            $payload = [
                'type' => 'model',
                'class' => $class,
                'message' => $class,
                'attributes' => $attributes,
            ];
            foreach (['relations', 'exists', 'connection'] as $key) {
                if (isset($opts[$key])) {
                    $payload[$key] = $opts[$key];
                    unset($opts[$key]);
                }
            }

            self::emit($payload, $opts);
        } catch (\Throwable) {
            // never break the host app
        }
    }

    /**
     * Report a list of items.
     *
     * @param array<int|string,mixed> $items
     * @param array<string,mixed>     $opts  envelope overrides (+ optional `message`)
     */
    public static function collection(array $items, array $opts = []): void
    {
        try {
            $payload = [
                'type' => 'collection',
                'count' => \count($items),
                'items' => \array_values($items),
            ];
            if (isset($opts['message'])) {
                $payload['message'] = $opts['message'];
                unset($opts['message']);
            }

            self::emit($payload, $opts);
        } catch (\Throwable) {
            // never break the host app
        }
    }

    /**
     * Report an explicit table of columns and rows.
     *
     * @param array<int,string>     $columns
     * @param array<int,mixed>      $rows    arrays aligned to columns, or records
     * @param array<string,mixed>   $opts    envelope overrides (+ optional `message`)
     */
    public static function table(array $columns, array $rows, array $opts = []): void
    {
        try {
            $payload = [
                'type' => 'table',
                'columns' => \array_values($columns),
                'rows' => \array_values($rows),
            ];
            if (isset($opts['message'])) {
                $payload['message'] = $opts['message'];
                unset($opts['message']);
            }

            self::emit($payload, $opts);
        } catch (\Throwable) {
            // never break the host app
        }
    }

    /**
     * Report a single timing.
     *
     * Recognised $opts keys: `memory` (bytes), `context`, plus envelope overrides.
     *
     * @param array<string,mixed> $opts
     */
    public static function measure(string $name, float $timeMs, array $opts = []): void
    {
        try {
            $payload = [
                'type' => 'measure',
                'name' => $name,
                'message' => $name,
                'time' => $timeMs,
            ];
            foreach (['memory', 'context'] as $key) {
                if (isset($opts[$key])) {
                    $payload[$key] = $opts[$key];
                    unset($opts[$key]);
                }
            }

            self::emit($payload, $opts);
        } catch (\Throwable) {
            // never break the host app
        }
    }

    /**
     * Report a metric bundle with an optional breakdown.
     *
     * Recognised $opts keys: `breakdown`, `context`, plus envelope overrides.
     *
     * @param array<string,mixed> $metrics
     * @param array<string,mixed> $opts
     */
    public static function performance(array $metrics, array $opts = []): void
    {
        try {
            $payload = [
                'type' => 'performance',
                'message' => $opts['message'] ?? 'performance',
                'metrics' => $metrics,
            ];
            unset($opts['message']);
            foreach (['breakdown', 'context'] as $key) {
                if (isset($opts[$key])) {
                    $payload[$key] = $opts[$key];
                    unset($opts[$key]);
                }
            }

            self::emit($payload, $opts);
        } catch (\Throwable) {
            // never break the host app
        }
    }

    /**
     * Report a business/domain event.
     *
     * Recognised $opts keys: `entity`, `entity_id`, `actor`, `data`, `metadata`,
     * plus envelope overrides.
     *
     * @param array<string,mixed> $opts
     */
    public static function event(string $event, array $opts = []): void
    {
        try {
            $payload = [
                'type' => 'event',
                'event' => $event,
                'message' => $event,
            ];
            foreach (['entity', 'entity_id', 'actor', 'data', 'metadata'] as $key) {
                if (isset($opts[$key])) {
                    $payload[$key] = $opts[$key];
                    unset($opts[$key]);
                }
            }

            self::emit($payload, $opts);
        } catch (\Throwable) {
            // never break the host app
        }
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    /**
     * Merge the standard envelope (timestamp/flag/channel/schemaVersion) onto a
     * payload, then ship it. `$opts` may override `flag`, `channel` and `origin`.
     *
     * @param array<string,mixed> $payload the type-specific body
     * @param array<string,mixed> $opts    envelope overrides
     */
    private static function emit(array $payload, array $opts = []): void
    {
        $envelope = [
            'timestamp' => (int) (\microtime(true) * 1000),
            'flag' => $opts['flag'] ?? 'gray',
            'channel' => $opts['channel'] ?? 'default',
            'schemaVersion' => 1,
        ];
        if (isset($opts['origin'])) {
            $envelope['origin'] = $opts['origin'];
        }

        // Payload-supplied flag/channel win unless the caller overrode them.
        self::send(\array_merge($envelope, $payload, [
            'flag' => $opts['flag'] ?? $payload['flag'] ?? $envelope['flag'],
            'channel' => $opts['channel'] ?? $payload['channel'] ?? $envelope['channel'],
        ]));
    }

    /**
     * Build a structured stack trace from a Throwable.
     *
     * @return array<int,array<string,mixed>>
     */
    private static function trace(\Throwable $e): array
    {
        $frames = [];
        foreach ($e->getTrace() as $frame) {
            $entry = [
                'file' => $frame['file'] ?? null,
                'line' => $frame['line'] ?? null,
                'function' => $frame['function'] ?? null,
            ];
            if (isset($frame['class'])) {
                $entry['class'] = $frame['class'];
            }
            if (isset($frame['type'])) {
                $entry['type'] = $frame['type'];
            }
            $frames[] = $entry;
        }

        return $frames;
    }

    /**
     * Map an HTTP status code to a flag color.
     */
    private static function flagForStatus(?int $status): string
    {
        if ($status === null) {
            return 'blue';
        }
        if ($status >= 500) {
            return 'red';
        }
        if ($status >= 400) {
            return 'yellow';
        }
        if ($status >= 300) {
            return 'blue';
        }

        return 'green';
    }

    /**
     * Map a log level to a flag color.
     */
    private static function flagForLevel(string $level): string
    {
        return match (\strtolower($level)) {
            'emergency', 'alert', 'critical', 'error', 'err' => 'red',
            'warning', 'warn', 'notice' => 'yellow',
            'info' => 'blue',
            default => 'gray',
        };
    }

    /**
     * Truncate a string to a maximum length, appending an ellipsis.
     */
    private static function truncate(string $value, int $max): string
    {
        if (\strlen($value) <= $max) {
            return $value;
        }

        return \substr($value, 0, $max).'…';
    }

    /**
     * First stack frame outside this SDK, as ['file','line','function'].
     *
     * @return array<string,mixed>|null
     */
    private static function caller(): ?array
    {
        $trace = \debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 12);
        foreach ($trace as $frame) {
            $file = $frame['file'] ?? null;
            if ($file === null) {
                continue;
            }
            if (\str_starts_with($file, __DIR__)) {
                continue; // skip SDK frames
            }

            return [
                'file' => $file,
                'line' => $frame['line'] ?? 0,
                'function' => $frame['function'] ?? null,
            ];
        }

        return null;
    }

    /**
     * POST a dump, fire-and-forget. Uses cURL when available, else a stream.
     *
     * @param array<string,mixed> $message
     */
    private static function send(array $message): void
    {
        $config = self::config();
        if (!$config['enabled']) {
            return;
        }

        $json = \json_encode($message, JSON_PARTIAL_OUTPUT_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($json === false) {
            return;
        }

        $url = \sprintf('http://%s:%d%s', $config['host'], $config['port'], $config['path']);
        $headers = ['Content-Type: application/json'];
        if ($config['token'] !== '') {
            $headers[] = 'X-Dumpio-Token: '.$config['token'];
        }
        $timeoutMs = (int) $config['timeoutMs'];

        if (\function_exists('curl_init')) {
            $ch = \curl_init($url);
            \curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $json,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT_MS => $timeoutMs,
                CURLOPT_CONNECTTIMEOUT_MS => $timeoutMs,
            ]);
            \curl_exec($ch);
            // curl_close() is a no-op since PHP 8.0 (handles are objects).

            return;
        }

        $context = \stream_context_create(['http' => [
            'method' => 'POST',
            'header' => \implode("\r\n", $headers),
            'content' => $json,
            'timeout' => $timeoutMs / 1000,
            'ignore_errors' => true,
        ]]);
        @\file_get_contents($url, false, $context);
    }
}
