<?php

declare(strict_types=1);

namespace App\Shared\Audit;

use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

/**
 * @implements CastsAttributes<CarbonImmutable, mixed>
 */
final class PreciseTimestamp implements CastsAttributes
{
    public const FORMAT = 'Y-m-d H:i:s.u';

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): ?CarbonImmutable
    {
        if ($value === null) {
            return null;
        }

        if (! is_string($value) && ! $value instanceof DateTimeInterface) {
            throw new InvalidArgumentException("Horodatage illisible pour {$key}.");
        }

        // Le curseur de pagination sérialise la date par __toString : sans les microsecondes, il sauterait des lignes.
        return CarbonImmutable::parse($value)->settings(['toStringFormat' => self::FORMAT]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        if (! $value instanceof DateTimeInterface) {
            throw new InvalidArgumentException("{$key} attend une date.");
        }

        return $value->format(self::FORMAT);
    }
}
