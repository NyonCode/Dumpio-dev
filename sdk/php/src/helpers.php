<?php

declare(strict_types=1);

use Dumpio\Dumpio;

if (!\function_exists('dumpio')) {
    /**
     * Send a value to the Dumpio app as a faithful, typed `var` dump.
     *
     * Returns the value unchanged, so it can wrap an expression like Laravel's
     * `tap()`: `return dumpio($user, 'user');`. For a chainable builder use
     * {@see dio()} instead.
     */
    function dumpio(mixed $value, ?string $label = null, string $flag = 'blue'): mixed
    {
        Dumpio::dump($value, $label, $flag);

        return $value;
    }
}

if (!\function_exists('dio')) {
    /**
     * Begin a fluent Dumpio dump (Ray-style):
     *
     *   dio($user)->red()->label('user')->channel('auth');
     *   dio($value);                        // ships at end of statement
     *   dio($n)->count();                   // live-updating counter
     *   dio($x)->when($debug)->yellow();    // conditional send
     *
     * Returns the {@see \Dumpio\PendingDump} builder, which ships on `->send()`
     * or automatically when it goes out of scope (so `->send()` is optional).
     * If you need the value passed through (tap-style `return …($x)`), use
     * {@see dumpio()} instead.
     */
    function dio(mixed $value, ?string $label = null, ?string $flag = null): \Dumpio\PendingDump
    {
        $dump = Dumpio::make($value);

        if ($label !== null) {
            $dump->label($label);
        }
        if ($flag !== null) {
            $dump->flag($flag);
        }

        return $dump;
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
