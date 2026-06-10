<?php

declare(strict_types=1);

namespace Dumpio\Symfony\EventSubscriber;

use Dumpio\Dumpio;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Messenger\Event\SendMessageToTransportsEvent;
use Symfony\Component\Messenger\Event\WorkerMessageFailedEvent;
use Symfony\Component\Messenger\Event\WorkerMessageHandledEvent;
use Symfony\Component\Messenger\Event\WorkerMessageReceivedEvent;
use Throwable;

/**
 * Forwards Symfony Messenger lifecycle to the Dumpio viewer as `event` dumps —
 * the Symfony equivalent of Laravel's queued-job listeners.
 *
 * Only registered when Messenger is installed (see {@see \Dumpio\Symfony\DumpioBundle}),
 * and inert otherwise. Fire-and-forget: never affects message handling.
 */
final class MessengerSubscriber implements EventSubscriberInterface
{
    /**
     * @return array<string,string>
     */
    public static function getSubscribedEvents(): array
    {
        return [
            SendMessageToTransportsEvent::class => 'onSend',
            WorkerMessageReceivedEvent::class => 'onReceived',
            WorkerMessageHandledEvent::class => 'onHandled',
            WorkerMessageFailedEvent::class => 'onFailed',
        ];
    }

    public function onSend(SendMessageToTransportsEvent $event): void
    {
        $this->emit('messenger.sent', $event->getEnvelope()->getMessage(), 'blue');
    }

    public function onReceived(WorkerMessageReceivedEvent $event): void
    {
        $this->emit('messenger.received', $event->getEnvelope()->getMessage(), 'blue', $event->getReceiverName());
    }

    public function onHandled(WorkerMessageHandledEvent $event): void
    {
        $this->emit('messenger.handled', $event->getEnvelope()->getMessage(), 'green', $event->getReceiverName());
    }

    public function onFailed(WorkerMessageFailedEvent $event): void
    {
        try {
            Dumpio::event('messenger.failed', [
                'data' => [
                    'message' => \get_class($event->getEnvelope()->getMessage()),
                    'receiver' => $event->getReceiverName(),
                    'will_retry' => $event->willRetry(),
                    'exception' => $event->getThrowable()->getMessage(),
                ],
                'flag' => 'red',
                'channel' => 'messenger',
            ]);
        } catch (Throwable) {
            // never break the host app
        }
    }

    private function emit(string $event, object $message, string $flag, ?string $receiver = null): void
    {
        try {
            $data = ['message' => \get_class($message)];
            if ($receiver !== null) {
                $data['receiver'] = $receiver;
            }
            Dumpio::event($event, ['data' => $data, 'flag' => $flag, 'channel' => 'messenger']);
        } catch (Throwable) {
            // never break the host app
        }
    }
}
