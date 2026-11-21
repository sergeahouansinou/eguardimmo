<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Jurisdictions;

/**
 * Règles de reddition de compte d'une juridiction (ADR 0008 : un contrat par juridiction, jamais de condition sur le pays).
 */
interface ManagementReportRules
{
    public function jurisdiction(): string;

    /**
     * Préfixe du numéro de compte rendu (`CR-AAAA-NNNN`).
     */
    public function numberPrefix(): string;

    public function templateVersion(): string;

    /**
     * @return list<string> mentions imprimées sur le compte rendu
     */
    public function mentions(): array;

    /**
     * Durée maximale sans compte rendu publié pour un mandant en cours de mandat.
     */
    public function maximumGapMonths(): int;

    public function retentionYears(): int;
}
