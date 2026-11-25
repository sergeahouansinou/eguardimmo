<?php

declare(strict_types=1);

namespace App\Modules\Listings\Enums;

enum CancellationPolicy: string
{
    case Flexible = 'flexible';
    case Moderate = 'moderate';
    case Strict = 'strict';

    /**
     * Part remboursée, en pour cent, d'une annulation faite `$joursAvant` jours avant l'arrivée.
     */
    public function refundPercent(int $joursAvant): int
    {
        return match ($this) {
            self::Flexible => $joursAvant >= 1 ? 100 : 0,
            self::Moderate => $joursAvant >= 5 ? 100 : 0,
            self::Strict => $joursAvant >= 7 ? 50 : 0,
        };
    }
}
