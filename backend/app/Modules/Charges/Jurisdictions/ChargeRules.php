<?php

declare(strict_types=1);

namespace App\Modules\Charges\Jurisdictions;

use Carbon\CarbonImmutable;

/**
 * Règles de la régularisation des charges d'une juridiction (ADR 0008, 0034) : données datées, jamais de condition sur le pays.
 */
interface ChargeRules
{
    public function jurisdiction(): string;

    public function templateVersion(): string;

    /**
     * @return list<string> clés du vocabulaire de plateforme `charge_rubric`
     */
    public function recoverableRubrics(): array;

    /**
     * @return list<string> sens système de catégorie de dépense jamais récupérables
     */
    public function nonRecoverableCategories(): array;

    public function admitsRegime(string $regimeKey): bool;

    public function dueDelayMonths(CarbonImmutable $at): int;

    public function isLate(CarbonImmutable $periodEndExclusive, CarbonImmutable $issuedOn): bool;

    public function documentAvailabilityMonths(CarbonImmutable $at): int;

    public function prescriptionYears(CarbonImmutable $at): int;

    /**
     * @return list<string>
     */
    public function mentions(CarbonImmutable $at): array;
}
