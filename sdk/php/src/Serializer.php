<?php

declare(strict_types=1);

namespace Dumpio;

/**
 * Serializes any PHP value into Dumpio's language-agnostic `var` tree
 * (PLAN-VIEWER C1). Uses Reflection so member visibility (public/protected/
 * private), class names, typed/uninitialized properties and enums are preserved
 * — the same fidelity goal as Symfony's VarCloner, with no hard dependency.
 *
 * A node is an array: ['kind' => ..., 'class'? , 'visibility'?, 'key'?,
 * 'value'?, 'children'?, 'refId'?, 'truncated'?].
 */
final class Serializer
{
    /** @var array<int,int> spl_object_id => refId */
    private array $seen = [];

    private int $counter = 0;

    public function __construct(
        private int $maxDepth = 6,
        private int $maxItems = 100,
        private int $maxString = 2000
    ) {
    }

    /**
     * @return array<string,mixed> the root VarNode
     */
    public function serialize(mixed $value): array
    {
        $this->seen = [];
        $this->counter = 0;

        return $this->walk($value, 0);
    }

    /**
     * @return array<string,mixed>
     */
    private function walk(mixed $value, int $depth): array
    {
        if ($value === null) {
            return ['kind' => 'null'];
        }
        if (\is_bool($value)) {
            return ['kind' => 'bool', 'value' => $value];
        }
        if (\is_int($value)) {
            return ['kind' => 'int', 'value' => $value];
        }
        if (\is_float($value)) {
            if (!\is_finite($value)) {
                $special = \is_nan($value) ? 'NAN' : ($value > 0 ? 'INF' : '-INF');

                return ['kind' => 'float', 'class' => 'special', 'value' => $special];
            }

            return ['kind' => 'float', 'value' => $value];
        }
        if (\is_string($value)) {
            return $this->scalarString($value);
        }
        if (\is_resource($value)) {
            return ['kind' => 'resource', 'class' => \get_resource_type($value)];
        }
        if (\is_array($value)) {
            return $this->walkArray($value, $depth);
        }
        if ($value instanceof \Closure) {
            return ['kind' => 'callable', 'class' => 'Closure'];
        }
        if (\is_object($value)) {
            return $this->walkObject($value, $depth);
        }

        return ['kind' => 'string', 'value' => (string) $value];
    }

    /**
     * @return array<string,mixed>
     */
    private function scalarString(string $value): array
    {
        if (\strlen($value) > $this->maxString) {
            return [
                'kind' => 'string',
                'value' => \substr($value, 0, $this->maxString),
                'truncated' => true,
            ];
        }

        return ['kind' => 'string', 'value' => $value];
    }

    /**
     * @param array<int|string,mixed> $value
     *
     * @return array<string,mixed>
     */
    private function walkArray(array $value, int $depth): array
    {
        if ($depth >= $this->maxDepth) {
            return ['kind' => 'array', 'truncated' => true];
        }

        $node = ['kind' => 'array', 'refId' => ++$this->counter, 'children' => []];
        $count = 0;
        foreach ($value as $key => $item) {
            if ($count >= $this->maxItems) {
                $node['truncated'] = true;
                break;
            }
            $child = $this->walk($item, $depth + 1);
            $child['key'] = $key;
            $node['children'][] = $child;
            ++$count;
        }

        return $node;
    }

    /**
     * @return array<string,mixed>
     */
    private function walkObject(object $value, int $depth): array
    {
        $id = \spl_object_id($value);
        if (isset($this->seen[$id])) {
            return ['kind' => 'ref', 'refId' => $this->seen[$id]];
        }

        $class = \get_class($value);
        if ($depth >= $this->maxDepth) {
            return ['kind' => 'object', 'class' => $class, 'truncated' => true];
        }

        $refId = ++$this->counter;
        $this->seen[$id] = $refId;

        // Framework-aware shapes: render the *logical* value (model attributes,
        // collection items, a formatted date) instead of the raw internals.
        // Detection is by string class name, so the core stays framework-agnostic
        // and these branches are inert when Laravel/Doctrine are absent.
        $framework = $this->frameworkNode($value, $class, $depth, $refId);
        if ($framework !== null) {
            return $framework;
        }

        $node = ['kind' => 'object', 'class' => $class, 'refId' => $refId, 'children' => []];

        // Enums carry name (+ backing value) rather than properties.
        if ($value instanceof \UnitEnum) {
            $node['children'][] = ['kind' => 'string', 'value' => $value->name, 'key' => 'name'];
            if ($value instanceof \BackedEnum) {
                $node['children'][] = $this->walk($value->value, $depth + 1) + ['key' => 'value'];
            }

            return $node;
        }

        $ref = new \ReflectionObject($value);
        $count = 0;
        foreach ($ref->getProperties() as $prop) {
            if ($count >= $this->maxItems) {
                $node['truncated'] = true;
                break;
            }
            $prop->setAccessible(true);
            if (!$prop->isInitialized($value)) {
                $child = ['kind' => 'undefined'];
            } else {
                $child = $this->walk($prop->getValue($value), $depth + 1);
            }
            $child['visibility'] = $prop->isPublic()
                ? 'public'
                : ($prop->isProtected() ? 'protected' : 'private');
            $child['key'] = $prop->getName();
            $node['children'][] = $child;
            ++$count;
        }

        return $node;
    }

    /**
     * Recognise common framework value objects and render their logical shape.
     * Returns null for anything we don't special-case, so the caller falls back
     * to generic Reflection. Never throws — a failed branch returns null.
     *
     * @return array<string,mixed>|null
     */
    private function frameworkNode(object $value, string $class, int $depth, int $refId): ?array
    {
        try {
            // Dates: a single formatted string beats dumping the internals.
            if ($value instanceof \DateTimeInterface) {
                return [
                    'kind' => 'object',
                    'class' => $class,
                    'refId' => $refId,
                    'children' => [
                        ['kind' => 'string', 'value' => $value->format('Y-m-d H:i:s.u P'), 'key' => 'date'],
                    ],
                ];
            }

            // Eloquent model → its casted, visible attributes (incl. loaded
            // relations), not the raw $attributes/$original/$casts machinery.
            if (\is_a($value, 'Illuminate\\Database\\Eloquent\\Model')) {
                $node = ['kind' => 'object', 'class' => $class, 'refId' => $refId, 'children' => []];
                $count = 0;
                /** @phpstan-ignore-next-line dynamic Eloquent method */
                foreach ($value->attributesToArray() as $key => $attr) {
                    if ($count >= $this->maxItems) {
                        $node['truncated'] = true;
                        break;
                    }
                    $child = $this->walk($attr, $depth + 1);
                    $child['key'] = $key;
                    $node['children'][] = $child;
                    ++$count;
                }

                return $node;
            }

            // Laravel collection → its items as an array, tagged with the class.
            if (\is_a($value, 'Illuminate\\Support\\Collection')) {
                /** @phpstan-ignore-next-line dynamic Collection method */
                $node = $this->walkArray($value->all(), $depth);
                $node['class'] = $class;

                return $node;
            }
        } catch (\Throwable) {
            // fall through to generic reflection
        }

        return null;
    }
}
