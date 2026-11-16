<?php

declare(strict_types=1);

namespace App\Modules\Leases\Jurisdictions\Fr;

use App\Modules\Leases\Jurisdictions\LeaseRegime;
use App\Modules\Leases\Jurisdictions\RegimeField;
use Carbon\CarbonImmutable;

final class FurnishedResidentialRegime implements LeaseRegime
{
    public const string KEY = 'fr.residential.furnished';

    public function key(): string
    {
        return self::KEY;
    }

    public function jurisdiction(): string
    {
        return 'FR';
    }

    public function label(): string
    {
        return 'Logement meublé (loi du 6 juillet 1989)';
    }

    public function currency(): string
    {
        return 'EUR';
    }

    public function jurisdictionDataFields(): array
    {
        return [
            FrFields::revisionIndex(),
            FrFields::irlReferenceQuarter(),
            FrFields::tenseZone(),
            FrFields::rentControl(),
            FrFields::energyClass(),
            RegimeField::boolean('student'),
            RegimeField::integer('deposit_return_months', 1, 2),
        ];
    }

    public function jurisdictionDataRules(): array
    {
        return RegimeField::rulesOf($this->jurisdictionDataFields());
    }

    public function defaultDurationMonths(array $jurisdictionData): int
    {
        return FrFields::flag($jurisdictionData, 'student') ? 9 : 12;
    }

    public function minimumDurationMonths(array $jurisdictionData): int
    {
        return $this->defaultDurationMonths($jurisdictionData);
    }

    public function maximumDurationMonths(array $jurisdictionData): ?int
    {
        return null;
    }

    public function tacitRenewal(array $jurisdictionData): bool
    {
        return ! FrFields::flag($jurisdictionData, 'student');
    }

    public function renewalMonths(array $jurisdictionData): ?int
    {
        return $this->tacitRenewal($jurisdictionData) ? 12 : null;
    }

    public function depositCapMonths(array $jurisdictionData): int
    {
        return 2;
    }

    public function tenantNoticeMonths(array $jurisdictionData): int
    {
        return 1;
    }

    public function landlordNoticeMonths(array $jurisdictionData): int
    {
        return 3;
    }

    public function nextRevisionDate(CarbonImmutable $startsOn, ?CarbonImmutable $lastRevisionOn, array $jurisdictionData): ?CarbonImmutable
    {
        return FrFields::annualRevision($startsOn, $lastRevisionOn, $jurisdictionData);
    }
}
