<?php

declare(strict_types=1);

use Dumpio\Dumpio;

if (!\function_exists('dumpio')) {
    /**
     * Send a value to the Dumpio app as a faithful, typed `var` dump.
     *
     * Returns the value unchanged, so it can wrap an expression like Laravel's
     * `tap()`: `return dumpio($user, 'user');`
     */
    function dumpio(mixed $value, ?string $label = null, string $flag = 'blue'): mixed
    {
        Dumpio::dump($value, $label, $flag);

        return $value;
    }
}

if (! function_exists('dio')) {

    /**
     * Send a value to the Dumpio app as a faithful, typed `var` dump.
     *
     * Returns the value unchanged, so it can wrap an expression like Laravel's
     * `tap()`: `return dumpio($user, 'user');`
     */
    function dio(mixed $value, ?string $label = null, string $flag = 'blue'): mixed
    {
        Dumpio::dump($value, $label, $flag);

        return $value;
    }
}

if (!\function_exists('ddio')) {
    /**
     * Dump every argument to Dumpio, then stop execution.
     */
    function ddio(mixed ...$values): never
    {
        Dumpio::dd(...$values);
    }
}

if (!\function_exists('dumpio_exception')) {
    /**
     * Report a Throwable to Dumpio with a structured stack trace.
     *
     * @param array<string,mixed> $context
     * @param array<string,mixed> $opts
     */
    function dumpio_exception(\Throwable $e, array $context = [], array $opts = []): void
    {
        Dumpio::exception($e, $context, $opts);
    }
}

if (!\function_exists('dumpio_query')) {
    /**
     * Report a database query to Dumpio.
     *
     * @param array<int|string,mixed> $bindings
     * @param array<string,mixed>     $opts
     */
    function dumpio_query(string $sql, array $bindings = [], ?float $timeMs = null, array $opts = []): void
    {
        Dumpio::query($sql, $bindings, $timeMs, $opts);
    }
}
