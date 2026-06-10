<?php

declare(strict_types=1);

namespace Dumpio;

/**
 * Fluent builder for a `var` dump, returned by {@see Dumpio::make()}:
 *
 *   Dumpio::make($user)->red()->label('user')->channel('auth')->send();
 *   Dumpio::make($n)->count();                 // aggregates per call-site
 *   Dumpio::make($x)->once();                  // send only the first hit
 *   Dumpio::make($x)->limit(5);                // send at most 5 times
 *
 * The dump ships on {@see send()}, or automatically when the builder is
 * destroyed, so `->send()` is optional. Like the rest of the client it never
 * throws into the host app.
 */
final class PendingDump
{
    private string $flag = 'blue';

    private ?string $label = null;

    private string $channel = 'default';

    private bool $sent = false;

    /** When true, the dump carries a stable dedupe key + running count. */
    private bool $aggregate = false;

    private bool $once = false;

    private ?int $limit = null;

    /** @var array<string,int> per-process hit counts, keyed by call-site */
    private static array $counts = [];

    /**
     * @param array<string,mixed>|null $caller file/line/function of the call site
     */
    public function __construct(private mixed $value, private ?array $caller = null)
    {
    }

    public function flag(string $flag): self
    {
        $this->flag = $flag;

        return $this;
    }

    public function label(string $label): self
    {
        $this->label = $label;

        return $this;
    }

    public function channel(string $channel): self
    {
        $this->channel = $channel;

        return $this;
    }

    public function red(): self
    {
        return $this->flag('red');
    }

    public function yellow(): self
    {
        return $this->flag('yellow');
    }

    public function blue(): self
    {
        return $this->flag('blue');
    }

    public function gray(): self
    {
        return $this->flag('gray');
    }

    public function purple(): self
    {
        return $this->flag('purple');
    }

    public function pink(): self
    {
        return $this->flag('pink');
    }

    public function green(): self
    {
        return $this->flag('green');
    }

    /**
     * Send only the first time this call-site is reached (per process).
     */
    public function once(): self
    {
        $this->once = true;

        return $this;
    }

    /**
     * Send at most `$max` times from this call-site (per process).
     */
    public function limit(int $max): self
    {
        $this->limit = $max;

        return $this;
    }

    /**
     * Collapse repeated sends from this call-site onto a single, live-updating
     * entry in the viewer (carries a `dedupeKey` and running `count`). Ships now.
     */
    public function count(): void
    {
        $this->aggregate = true;
        $this->send();
    }

    /**
     * Ship the dump (idempotent). Honours once()/limit() gating.
     */
    public function send(): void
    {
        if ($this->sent) {
            return;
        }
        $this->sent = true;

        $extra = [];

        if ($this->once || $this->limit !== null || $this->aggregate) {
            $key = $this->callSiteKey();
            $n = (self::$counts[$key] ?? 0) + 1;
            self::$counts[$key] = $n;

            if ($this->once && $n > 1) {
                return;
            }
            if ($this->limit !== null && $n > $this->limit) {
                return;
            }
            if ($this->aggregate) {
                $extra['dedupeKey'] = $key;
                $extra['count'] = $n;
            }
        }

        Dumpio::dumpVar($this->value, $this->label, $this->flag, $this->channel, $this->caller, $extra);
    }

    public function __destruct()
    {
        // Auto-send for the fluent shorthand `Dumpio::make($x)->red();`.
        if (!$this->sent) {
            $this->send();
        }
    }

    /**
     * A stable key for this call-site (file:line), used for once/limit/count.
     */
    private function callSiteKey(): string
    {
        $file = $this->caller['file'] ?? '?';
        $line = $this->caller['line'] ?? 0;

        return \md5($file.':'.$line);
    }
}
