<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Support;

use App\Modules\Mandates\Enums\ErrorCode;
use Carbon\CarbonImmutable;

/**
 * L'API exprime le dernier jour inclus ; la base stocke la fin exclue (intervalles semi-ouverts).
 */
final class MandatePeriod
{
    public static function endExclusive(string $startsOn, string $lastDay): string
    {
        $fin = CarbonImmutable::parse($lastDay)->addDay()->toDateString();

        if ($fin <= $startsOn) {
            throw ErrorCode::MandatePeriodInvalid->problem('La date de fin doit suivre la date de début du mandat.');
        }

        return $fin;
    }
}
