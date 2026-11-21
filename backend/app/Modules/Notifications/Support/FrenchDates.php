<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use Carbon\CarbonInterface;

final class FrenchDates
{
    public static function monthYear(CarbonInterface $date): string
    {
        /** @var CarbonInterface $localisee */
        $localisee = $date->copy()->locale('fr');

        return $localisee->translatedFormat('F Y');
    }
}
