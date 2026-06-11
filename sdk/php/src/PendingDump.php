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

    /** When true, a {@see when()} gate failed and nothing should ship. */
    private bool $suppressed = false;

    /** Optional explicit key for once/limit/count, set by {@see count()}. */
    private ?string $countName = null;

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
     * Only ship when `$condition` is true; otherwise the dump is silently
     * dropped (and does not count toward once()/limit()/count()):
     *
     *   dio($payload)->when($request->isDebug())->yellow();
     */
    public function when(bool $condition): self
    {
        if (!$condition) {
            $this->suppressed = true;
        }

        return $this;
    }

    /**
     * Inverse of {@see when()}: ship only when `$condition` is false.
     */
    public function unless(bool $condition): self
    {
        return $this->when(!$condition);
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
     * Collapse repeated sends onto a single, live-updating entry in the viewer
     * (carries a `dedupeKey` and running `count`). Ships now.
     *
     * By default repeats are grouped per call-site; pass `$name` to share a
     * counter across call-sites (e.g. `dio($x)->count('loop')`).
     */
    public function count(?string $name = null): void
    {
        $this->aggregate = true;
        if ($name !== null) {
            $this->countName = $name;
        }
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

        if ($this->suppressed) {
            return;
        }

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
     * A stable key for once/limit/count: the explicit {@see count()} name when
     * set, otherwise this call-site (file:line).
     */
    private function callSiteKey(): string
    {
        if ($this->countName !== null) {
            return \md5('name:'.$this->countName);
        }

        $file = $this->caller['file'] ?? '?';
        $line = $this->caller['line'] ?? 0;

        return \md5($file.':'.$line);
    }
}
