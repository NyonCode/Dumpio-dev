<?php

declare(strict_types=1);

namespace Dumpio\Laravel;

use Dumpio\Dumpio;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\ServiceProvider;
use Throwable;

/**
 * Wires the Dumpio client into a Laravel application.
 *
 * - Publishes and applies `config/dumpio.php` → {@see Dumpio::configure()}.
 * - Optionally forwards every executed query as a `query` dump (`DB::listen`).
 * - Optionally forwards reported exceptions as `exception` dumps.
 *
 * Everything is guarded: when `dumpio.enabled` is false (the default in
 * production), the provider configures the client as disabled and registers no
 * listeners, so it is a complete no-op.
 *
 * Registered automatically via Composer package discovery (see composer.json
 * `extra.laravel.providers`).
 */
final class DumpioServiceProvider extends ServiceProvider
{
    /**
     * Register the merged config and the static client configuration.
     */
    public function register(): void
    {
        $this->mergeConfigFrom($this->configPath(), 'dumpio');
    }

    /**
     * Apply config and wire optional query/exception listeners.
     */
    public function boot(): void
    {
        $this->publishes([
            $this->configPath() => $this->app->basePath('config/dumpio.php'),
        ], 'dumpio-config');

        /** @var array<string,mixed> $config */
        $config = $this->app['config']->get('dumpio', []);
        $enabled = (bool) ($config['enabled'] ?? false);

        Dumpio::configure([
            'host' => $config['host'] ?? 'localhost',
            'port' => (int) ($config['port'] ?? 21234),
            'token' => (string) ($config['token'] ?? ''),
            'enabled' => $enabled,
        ]);

        if (!$enabled) {
            return;
        }

        if (!empty($config['listen_queries'])) {
            $this->listenQueries();
        }
        if (!empty($config['listen_exceptions'])) {
            $this->listenExceptions();
        }
        if (!empty($config['intercept_dumps'])) {
            $this->interceptDumps();
        }
        if (!empty($config['listen_models'])) {
            $this->listenModels();
        }
        if (!empty($config['listen_cache'])) {
            $this->listenCache();
        }
        if (!empty($config['listen_jobs'])) {
            $this->listenJobs();
        }
        if (!empty($config['listen_events'])) {
            $this->listenEvents();
        }

        // Chainable ->dio() / ->ddio() macros on query builders & collections.
        // Registered unconditionally (pay only when called); a separate flag can
        // disable them.
        if ($config['register_macros'] ?? true) {
            $this->registerMacros();
        }
    }

    /**
     * Register chainable debug macros, mirroring the inline-dump ergonomics of
     * tools like Ray:
     *
     *     User::query()->where('name', 'John')->dio()->whereDate(...)->first();
     *     collect([1, 2, 3])->dio('after map');
     *
     * `->dio()` ships the current state and returns `$this` so the chain
     * continues; `->ddio()` ships and then dies. Query builders emit a `query`
     * dump (SQL + bindings); collections emit a `var` dump.
     *
     * Macros must use real closures (not arrow fns) so Laravel can rebind `$this`
     * to the builder/collection instance.
     */
    private function registerMacros(): void
    {
        try {
            $queryDio = function (?string $label = null) {
                Dumpio::query($this->toSql(), $this->getBindings(), null, ['channel' => 'query']);

                return $this;
            };
            $queryDdio = function (?string $label = null): never {
                Dumpio::query($this->toSql(), $this->getBindings(), null, ['channel' => 'query']);
                exit(1);
            };

            foreach ([
                \Illuminate\Database\Eloquent\Builder::class,
                \Illuminate\Database\Query\Builder::class,
            ] as $class) {
                if (!\class_exists($class) || !\method_exists($class, 'macro')) {
                    continue;
                }
                if (!$class::hasMacro('dio')) {
                    $class::macro('dio', $queryDio);
                }
                if (!$class::hasMacro('ddio')) {
                    $class::macro('ddio', $queryDdio);
                }
            }

            $collection = \Illuminate\Support\Collection::class;
            if (\class_exists($collection) && !$collection::hasMacro('dio')) {
                $collection::macro('dio', function (?string $label = null) {
                    Dumpio::dump($this, $label);

                    return $this;
                });
                $collection::macro('ddio', function (?string $label = null): never {
                    Dumpio::dump($this, $label);
                    exit(1);
                });
            }
        } catch (Throwable) {
            // never break the host app
        }
    }

    /**
     * Forward every executed database query as a `query` dump.
     */
    private function listenQueries(): void
    {
        try {
            $db = $this->app['db'] ?? null;
            if ($db === null) {
                return;
            }
            $db->listen(static function (QueryExecuted $query): void {
                Dumpio::query(
                    $query->sql,
                    $query->bindings,
                    $query->time,
                    ['connection' => $query->connectionName]
                );
            });
        } catch (Throwable) {
            // never break the host app
        }
    }

    /**
     * Forward exceptions reported through the application's exception handler.
     *
     * Hooks the `Illuminate\Log\Events\MessageLogged` channel is fragile, so we
     * subscribe to the framework's exception-reporting event instead. On
     * Laravel 11+ this is the recommended `report` callback; we register it via
     * the resolved handler when available, falling back to a no-op.
     */
    private function listenExceptions(): void
    {
        try {
            $handler = $this->app->make(\Illuminate\Contracts\Debug\ExceptionHandler::class);
            if (\method_exists($handler, 'reportable')) {
                $handler->reportable(static function (Throwable $e): void {
                    Dumpio::exception($e, [], ['framework' => 'laravel']);
                });
            }
        } catch (Throwable) {
            // never break the host app
        }
    }

    /**
     * Route the framework's dump()/dd() helpers into the Dumpio viewer.
     *
     * Both helpers funnel through Symfony's VarDumper, so installing a handler
     * captures `dump()` and `dd()` (and `dd()` still dies afterwards). Inline
     * rendering is replaced by a forward to the viewer.
     */
    private function interceptDumps(): void
    {
        try {
            if (!\class_exists(\Symfony\Component\VarDumper\VarDumper::class)) {
                return;
            }
            \Symfony\Component\VarDumper\VarDumper::setHandler(static function (mixed $var): void {
                Dumpio::dump($var, null, 'blue', 'dump');
            });
        } catch (Throwable) {
            // never break the host app
        }
    }

    /**
     * Forward Eloquent model lifecycle events as `model` dumps.
     */
    private function listenModels(): void
    {
        try {
            $events = $this->app['events'] ?? null;
            if ($events === null) {
                return;
            }
            $flags = ['created' => 'green', 'updated' => 'yellow', 'deleted' => 'red', 'restored' => 'blue'];
            foreach ($flags as $verb => $flag) {
                $events->listen("eloquent.{$verb}: *", static function (string $name, array $payload) use ($verb, $flag): void {
                    $model = $payload[0] ?? null;
                    if (!\is_object($model) || !\method_exists($model, 'getAttributes')) {
                        return;
                    }
                    Dumpio::model(\get_class($model), $model->getAttributes(), [
                        'exists' => $model->exists ?? true,
                        'connection' => \method_exists($model, 'getConnectionName') ? $model->getConnectionName() : null,
                        'message' => $verb.' '.\get_class($model),
                        'flag' => $flag,
                        'channel' => 'models',
                    ]);
                });
            }
        } catch (Throwable) {
            // never break the host app
        }
    }

    /**
     * Forward cache events (hit/missed/written/forgotten) as `event` dumps.
     */
    private function listenCache(): void
    {
        try {
            $events = $this->app['events'] ?? null;
            if ($events === null) {
                return;
            }
            $map = [
                \Illuminate\Cache\Events\CacheHit::class => ['cache.hit', 'green'],
                \Illuminate\Cache\Events\CacheMissed::class => ['cache.missed', 'yellow'],
                \Illuminate\Cache\Events\KeyWritten::class => ['cache.written', 'blue'],
                \Illuminate\Cache\Events\KeyForgotten::class => ['cache.forgotten', 'gray'],
            ];
            foreach ($map as $class => [$event, $flag]) {
                if (!\class_exists($class)) {
                    continue;
                }
                $events->listen($class, static function (object $e) use ($event, $flag): void {
                    Dumpio::event($event, [
                        'data' => ['key' => $e->key ?? null],
                        'flag' => $flag,
                        'channel' => 'cache',
                    ]);
                });
            }
        } catch (Throwable) {
            // never break the host app
        }
    }

    /**
     * Forward queued-job lifecycle (processing/processed/failed) as `event` dumps.
     */
    private function listenJobs(): void
    {
        try {
            $events = $this->app['events'] ?? null;
            if ($events === null) {
                return;
            }
            $map = [
                \Illuminate\Queue\Events\JobProcessing::class => ['job.processing', 'blue'],
                \Illuminate\Queue\Events\JobProcessed::class => ['job.processed', 'green'],
                \Illuminate\Queue\Events\JobFailed::class => ['job.failed', 'red'],
            ];
            foreach ($map as $class => [$event, $flag]) {
                if (!\class_exists($class)) {
                    continue;
                }
                $events->listen($class, static function (object $e) use ($event, $flag): void {
                    $job = $e->job ?? null;
                    $data = [
                        'job' => (\is_object($job) && \method_exists($job, 'resolveName')) ? $job->resolveName() : null,
                        'connection' => $e->connectionName ?? null,
                    ];
                    if (isset($e->exception) && $e->exception instanceof Throwable) {
                        $data['exception'] = $e->exception->getMessage();
                    }
                    Dumpio::event($event, ['data' => $data, 'flag' => $flag, 'channel' => 'jobs']);
                });
            }
        } catch (Throwable) {
            // never break the host app
        }
    }

    /**
     * Forward application (non-framework) events as `event` dumps. Best-effort:
     * framework-internal events (Illuminate\*, eloquent.*, cache/job events
     * already handled above) are filtered out to avoid a firehose.
     */
    private function listenEvents(): void
    {
        try {
            $events = $this->app['events'] ?? null;
            if ($events === null) {
                return;
            }
            $events->listen('*', static function (string $name, array $payload): void {
                if (\str_starts_with($name, 'Illuminate\\')
                    || \str_starts_with($name, 'Symfony\\')
                    || \str_starts_with($name, 'eloquent.')
                    || \str_starts_with($name, 'Laravel\\')
                    || !\str_contains($name, '\\')
                ) {
                    return; // skip framework internals and bare string events
                }
                Dumpio::event($name, ['data' => ['payload_count' => \count($payload)], 'channel' => 'events']);
            });
        } catch (Throwable) {
            // never break the host app
        }
    }

    /**
     * Absolute path to the packaged config file.
     */
    private function configPath(): string
    {
        return \dirname(__DIR__, 2).'/config/dumpio.php';
    }
}
