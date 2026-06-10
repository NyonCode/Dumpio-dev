<?php

declare(strict_types=1);

namespace Dumpio\Symfony\Doctrine;

use Doctrine\DBAL\Driver\Middleware\AbstractStatementMiddleware;
use Doctrine\DBAL\Driver\Result;
use Doctrine\DBAL\Driver\Statement;
use Dumpio\Dumpio;

/**
 * Wraps a prepared statement, logging the SQL and its timing on execution.
 *
 * Bindings are intentionally not captured here: their bind signatures diverge
 * across DBAL versions, so we forward the SQL with empty bindings rather than
 * risk an incompatible override.
 */
final class DumpioStatement extends AbstractStatementMiddleware
{
    public function __construct(Statement $statement, private readonly string $sql)
    {
        parent::__construct($statement);
    }

    public function execute(): Result
    {
        $start = \microtime(true);
        try {
            return parent::execute();
        } finally {
            Dumpio::query($this->sql, [], (\microtime(true) - $start) * 1000, ['channel' => 'database']);
        }
    }
}
