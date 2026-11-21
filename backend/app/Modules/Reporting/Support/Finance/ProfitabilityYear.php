<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Finance;

use App\Modules\Reporting\Enums\ErrorCode;
use Carbon\CarbonImmutable;

final class ProfitabilityYear
{
    public const int FIRST = 2000;

    public static function assert(int $year, CarbonImmutable $today): int
    {
        if ($year < self::FIRST || $year > $today->year) {
            throw ErrorCode::ProfitabilityPeriodInvalid->problem();
        }

        return $year;
    }
}
