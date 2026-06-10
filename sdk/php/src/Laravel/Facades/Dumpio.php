<?php

declare(strict_types=1);

namespace Dumpio\Laravel\Facades;

use Dumpio\Dumpio as Client;

/**
 * Convenience facade for the Dumpio client.
 *
 * The underlying {@see \Dumpio\Dumpio} client is already static, so this facade
 * is purely ergonomic — it lets you write `Dumpio::dump(...)` after a single
 * `use Dumpio\Laravel\Facades\Dumpio;`. Every call is forwarded verbatim to the
 * static client and is therefore fire-and-forget.
 *
 * @method static void dump(mixed $value, ?string $label = null, string $flag = 'blue', string $channel = 'default')
 * @method static never dd(mixed ...$values)
 * @method static void exception(\Throwable $e, array $context = [], array $opts = [])
 * @method static void query(string $sql, array $bindings = [], ?float $timeMs = null, array $opts = [])
 * @method static void http(string $method, string $url, ?int $status = null, array $opts = [])
 * @method static void log(string $level, string $message, array $details = [], array $opts = [])
 * @method static void model(string $class, array $attributes, array $opts = [])
 * @method static void collection(array $items, array $opts = [])
 * @method static void table(array $columns, array $rows, array $opts = [])
 * @method static void measure(string $name, float $timeMs, array $opts = [])
 * @method static void performance(array $metrics, array $opts = [])
 * @method static void event(string $event, array $opts = [])
 * @method static void configure(array $options)
 *
 * @see \Dumpio\Dumpio
 */
final class Dumpio
{
    /**
     * Forward static calls to the underlying client.
     *
     * @param array<int,mixed> $arguments
     */
    public static function __callStatic(string $name, array $arguments): mixed
    {
        /** @var callable $target */
        $target = [Client::class, $name];

        return $target(...$arguments);
    }
}
