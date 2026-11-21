<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Models\ChargeExercise;
use Carbon\CarbonImmutable;

/**
 * Période `[début, fin[` d'un exercice (ADR 0034 § 5) : douze mois au plus, terminée avant aujourd'hui, sans chevauchement sous le verrou du bien.
 */
final class ExercisePeriods
{
    public function assertValid(CarbonImmutable $debut, CarbonImmutable $fin, CarbonImmutable $today): void
    {
        if ($debut->lt('2000-01-01') || $fin->lte($debut) || $fin->gt($debut->addMonths(12)) || $fin->gt($today->startOfDay())) {
            throw ErrorCode::ExercisePeriodInvalid->problem('La période compte douze mois au plus, se termine au plus tard aujourd\'hui (fin exclue) et commence après 2000.');
        }
    }

    public function assertFree(string $propertyId, CarbonImmutable $debut, CarbonImmutable $fin, ?string $exceptId = null): void
    {
        $existe = ChargeExercise::query()
            ->where('property_id', $propertyId)
            ->where('status', '<>', ExerciseStatus::Discarded->value)
            ->whereNull('only_lease_id')
            ->where('period_start', '<', $fin->toDateString())
            ->where('period_end', '>', $debut->toDateString())
            ->when($exceptId !== null, fn ($q) => $q->where('id', '<>', $exceptId))
            ->exists();

        if ($existe) {
            throw ErrorCode::ExerciseOverlap->problem();
        }
    }
}
