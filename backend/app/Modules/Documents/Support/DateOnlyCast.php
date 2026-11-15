<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Écrit `Y-m-d` : le cast `date` du modèle ajouterait l'heure, et la comparaison de chaînes SQL fausserait les échéances.
 *
 * @implements CastsAttributes<CarbonImmutable, CarbonInterface|string>
 */
final class DateOnlyCast implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?CarbonImmutable
    {
        return is_string($value) ? CarbonImmutable::parse($value)->startOfDay() : null;
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        return ($value instanceof CarbonInterface ? $value : CarbonImmutable::parse((string) $value))->toDateString();
    }
}
