<?php

declare(strict_types=1);

namespace Dumpio\Symfony\Doctrine;

use Doctrine\DBAL\Driver\Middleware\AbstractConnectionMiddleware;
use Doctrine\DBAL\Driver\Result;
use Doctrine\DBAL\Driver\Statement;
use Dumpio\Dumpio;

/**
 * Times direct queries (`query`/`exec`) and hands prepared statements to
 * {@see DumpioStatement} so they are logged when executed.
 */
final class DumpioConnection extends AbstractConnectionMiddleware
{
    public function prepare(string $sql): Statement
    {
        return new DumpioStatement(parent::prepare($sql), $sql);
    }

    public function query(string $sql): Result
    {
        $start = \microtime(true);
        try {
            return parent::query($sql);
        } finally {
            Dumpio::query($sql, [], (\microtime(true) - $start) * 1000, ['channel' => 'database']);
        }
    }

    public function exec(string $sql): int|string
    {
        $start = \microtime(true);
        try {
            return parent::exec($sql);
        } finally {
            Dumpio::query($sql, [], (\microtime(true) - $start) * 1000, ['channel' => 'database']);
        }
    }
}
