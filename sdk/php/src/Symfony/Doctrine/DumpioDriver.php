<?php

declare(strict_types=1);

namespace Dumpio\Symfony\Doctrine;

use Doctrine\DBAL\Driver\Connection;
use Doctrine\DBAL\Driver\Middleware\AbstractDriverMiddleware;

/**
 * Wraps each established connection so its statements can be timed and logged.
 */
final class DumpioDriver extends AbstractDriverMiddleware
{
    public function connect(array $params): Connection
    {
        return new DumpioConnection(parent::connect($params));
    }
}
