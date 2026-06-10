<?php

declare(strict_types=1);

namespace Dumpio\Symfony;

use Dumpio\Dumpio;
use Dumpio\Symfony\Doctrine\DumpioMiddleware;
use Dumpio\Symfony\EventSubscriber\ExceptionSubscriber;
use Dumpio\Symfony\EventSubscriber\MessengerSubscriber;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\HttpKernel\Bundle\Bundle;
use Symfony\Component\Messenger\Event\WorkerMessageReceivedEvent;
use Symfony\Component\VarDumper\VarDumper;

/**
 * Symfony bundle that forwards debug signals to the Dumpio client:
 *
 * - `kernel.exception` → `exception` dumps ({@see ExceptionSubscriber}), always.
 * - executed SQL → `query` dumps via a DBAL 4 `doctrine.middleware`, when Doctrine
 *   DBAL 4 is installed.
 * - Messenger lifecycle → `event` dumps ({@see MessengerSubscriber}), when
 *   symfony/messenger is installed.
 * - `dump()` / `dd()` → the viewer, when `DUMPIO_INTERCEPT_DUMPS` is set.
 *
 * Registration (config/bundles.php):
 *
 *     return [
 *         // …
 *         Dumpio\Symfony\DumpioBundle::class => ['dev' => true],
 *     ];
 *
 * The bundle reads `DUMPIO_HOST` / `DUMPIO_PORT` / `DUMPIO_TOKEN` /
 * `DUMPIO_DISABLE` from the environment (handled by the static client itself),
 * so no extension/configuration tree is required.
 */
final class DumpioBundle extends Bundle
{
    public function build(ContainerBuilder $container): void
    {
        parent::build($container);

        $definition = $container->register(ExceptionSubscriber::class, ExceptionSubscriber::class);
        $definition->setAutoconfigured(true);
        $definition->addTag('kernel.event_subscriber');

        // Forward executed SQL as `query` dumps. Requires Doctrine DBAL 4; when
        // absent (or on DBAL 3) the middleware is simply not registered.
        if (\class_exists(\Doctrine\DBAL\Driver\Middleware\AbstractConnectionMiddleware::class)) {
            $middleware = $container->register(DumpioMiddleware::class, DumpioMiddleware::class);
            $middleware->setAutoconfigured(true);
            $middleware->addTag('doctrine.middleware');
        }

        // Forward Messenger lifecycle as `event` dumps, when Messenger is present.
        if (\class_exists(WorkerMessageReceivedEvent::class)) {
            $messenger = $container->register(MessengerSubscriber::class, MessengerSubscriber::class);
            $messenger->setAutoconfigured(true);
            $messenger->addTag('kernel.event_subscriber');
        }
    }

    public function boot(): void
    {
        parent::boot();

        // Route dump()/dd() into the viewer when explicitly opted in. Both funnel
        // through VarDumper, so a single handler captures them (dd() still dies).
        $intercept = \getenv('DUMPIO_INTERCEPT_DUMPS');
        if ($intercept !== false && $intercept !== '' && $intercept !== '0' && \class_exists(VarDumper::class)) {
            VarDumper::setHandler(static function (mixed $var): void {
                Dumpio::dump($var, null, 'blue', 'dump');
            });
        }
    }
}
