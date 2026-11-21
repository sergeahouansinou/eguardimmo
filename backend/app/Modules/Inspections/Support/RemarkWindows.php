<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Support;

use App\Modules\Inspections\Enums\InspectionKind;
use App\Modules\Inspections\Enums\RemarkKind;
use App\Modules\Inspections\Models\Inspection;
use Carbon\CarbonImmutable;

/**
 * Fenêtres de remarque (ADR 0036, décision 6 ; textes à confirmer par un juriste) : complément de l'état d'entrée dans les 10 jours
 * suivant sa date, chauffage tant que le bail a moins de 13 mois (approximation de la première période de chauffe), commentaire
 * sur l'état de sortie pendant toute la période où le bail reste lisible.
 */
final class RemarkWindows
{
    public const COMPLEMENT_DAYS = 10;

    public const HEATING_MONTHS = 13;

    /**
     * @return list<RemarkKind>
     */
    public static function open(Inspection $etat, bool $active, CarbonImmutable $leaseStart, CarbonImmutable $today): array
    {
        if ($etat->kind === InspectionKind::Exit) {
            return [RemarkKind::Comment];
        }

        if (! $active) {
            return [];
        }

        $ouvertes = [];

        if ($today->toDateString() <= CarbonImmutable::parse($etat->performed_on)->addDays(self::COMPLEMENT_DAYS)->toDateString()) {
            $ouvertes[] = RemarkKind::Complement;
        }

        if ($today->toDateString() < $leaseStart->addMonthsNoOverflow(self::HEATING_MONTHS)->toDateString()) {
            $ouvertes[] = RemarkKind::Heating;
        }

        return $ouvertes;
    }
}
