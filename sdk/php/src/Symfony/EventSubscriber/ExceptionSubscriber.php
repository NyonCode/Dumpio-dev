<?php

declare(strict_types=1);

namespace Dumpio\Symfony\EventSubscriber;

use Dumpio\Dumpio;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Throwable;

/**
 * Forwards every `kernel.exception` to the Dumpio viewer as a structured
 * `exception` dump, enriched with the current request context.
 *
 * Fire-and-forget: failures here never affect Symfony's own error handling.
 */
final class ExceptionSubscriber implements EventSubscriberInterface
{
    /**
     * @return array<string,array{0:string,1:int}>
     */
    public static function getSubscribedEvents(): array
    {
        // Run late (low priority) so other listeners can decorate the request.
        return [
            KernelEvents::EXCEPTION => ['onKernelException', -64],
        ];
    }

    public function onKernelException(ExceptionEvent $event): void
    {
        try {
            $request = $event->getRequest();

            Dumpio::exception($event->getThrowable(), [
                'request' => [
                    'url' => $request->getUri(),
                    'method' => $request->getMethod(),
                    'query' => $request->query->all(),
                    'ip' => $request->getClientIp(),
                ],
            ], ['framework' => 'symfony']);
        } catch (Throwable) {
            // never break the host app
        }
    }
}
