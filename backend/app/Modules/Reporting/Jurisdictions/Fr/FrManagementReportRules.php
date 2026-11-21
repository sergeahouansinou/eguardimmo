<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Jurisdictions\Fr;

use App\Modules\Reporting\Jurisdictions\ManagementReportRules;

/**
 * Sources secondaires, à confirmer sur Légifrance (ADR 0030) : Code civil art. 1993, loi n° 70-9 du 2 janvier 1970 et
 * décret n° 72-678 du 20 juillet 1972.
 */
final class FrManagementReportRules implements ManagementReportRules
{
    public function jurisdiction(): string
    {
        return 'FR';
    }

    public function numberPrefix(): string
    {
        return 'CR';
    }

    public function templateVersion(): string
    {
        return 'CRG-1';
    }

    public function mentions(): array
    {
        return [
            'Compte rendu de gestion établi par le mandataire en application de l\'article 1993 du Code civil.',
            'Les fonds détenus pour le compte du mandant sont comptabilisés dans un compte de tiers distinct des fonds de l\'agence.',
            'Document établi à partir de la comptabilité de l\'agence au jour de son émission ; toute correction fait l\'objet d\'un compte rendu rectificatif.',
        ];
    }

    public function maximumGapMonths(): int
    {
        return 12;
    }

    public function retentionYears(): int
    {
        return 10;
    }
}
