<?php

declare(strict_types=1);

namespace Dumpio\Symfony\Doctrine;

use Doctrine\DBAL\Driver;
use Doctrine\DBAL\Driver\Middleware;

/**
 * Doctrine DBAL middleware that forwards every executed SQL statement to the
 * Dumpio viewer as a `query` dump.
 *
 * Registered via the `doctrine.middleware` tag (see {@see \Dumpio\Symfony\DumpioBundle}).
 * Targets DBAL 4. Fire-and-forget: logging never affects query execution.
 */
final class DumpioMiddleware implements Middleware
{
    public function wrap(Driver $driver): Driver
    {
        return new DumpioDriver($driver);
    }
}
