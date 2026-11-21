<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Support;

use Carbon\CarbonImmutable;

/**
 * Fenêtre d'accès du propriétaire : tant qu'un mandat est actif ou suspendu, puis 12 mois après le dernier jour du dernier
 * mandat, jour compris. Même règle de dates que la période de grâce du locataire (ADR 0024, 0030, 0032).
 */
final class OwnerWindow
{
    public const int MONTHS = 12;

    /**
     * Dernier jour d'accès, compris, pour le dernier jour couvert par le dernier mandat.
     */
    public static function until(string $lastDay): CarbonImmutable
    {
        return CarbonImmutable::parse($lastDay)->addMonthsNoOverflow(self::MONTHS);
    }

    /**
     * @param  string|null  $lastEndsOn  fin exclue du dernier mandat terminé ou expiré (Y-m-d), null s'il n'y en a pas
     * @return array{until: CarbonImmutable|null, inGrace: bool}|null null : la fenêtre est échue ou aucun mandat ne la porte
     */
    public static function resolve(bool $running, ?string $lastEndsOn, CarbonImmutable $today): ?array
    {
        if ($running) {
            return ['until' => null, 'inGrace' => false];
        }

        if ($lastEndsOn === null) {
            return null;
        }

        $dernierJour = CarbonImmutable::parse($lastEndsOn)->subDay();
        $jusqua = self::until($dernierJour->toDateString());

        if ($today->toDateString() > $jusqua->toDateString()) {
            return null;
        }

        return ['until' => $jusqua, 'inGrace' => $today->toDateString() > $dernierJour->toDateString()];
    }
}
