<?php

declare(strict_types=1);

namespace App\Modules\Leases\Jurisdictions\Fr;

use App\Modules\Leases\Jurisdictions\LeaseRegime;
use App\Modules\Leases\Jurisdictions\RegimeField;
use Carbon\CarbonImmutable;

final class UnfurnishedResidentialRegime implements LeaseRegime
{
    public const string KEY = 'fr.residential.unfurnished';

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
        return 'Logement vide (loi du 6 juillet 1989)';
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
            RegimeField::boolean('landlord_is_legal_entity'),
            RegimeField::boolean('advance_rent_over_two_months'),
            RegimeField::choice('tenant_notice_reason', FrFields::REDUCED_NOTICE_REASONS),
        ];
    }

    public function jurisdictionDataRules(): array
    {
        return RegimeField::rulesOf($this->jurisdictionDataFields());
    }

    public function defaultDurationMonths(array $jurisdictionData): int
    {
        return FrFields::flag($jurisdictionData, 'landlord_is_legal_entity') ? 72 : 36;
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
        return true;
    }

    public function renewalMonths(array $jurisdictionData): int
    {
        return $this->defaultDurationMonths($jurisdictionData);
    }

    public function depositCapMonths(array $jurisdictionData): int
    {
        return FrFields::flag($jurisdictionData, 'advance_rent_over_two_months') ? 0 : 1;
    }

    public function tenantNoticeMonths(array $jurisdictionData): int
    {
        $reduit = FrFields::flag($jurisdictionData, 'tense_zone') || ($jurisdictionData['tenant_notice_reason'] ?? null) !== null;

        return $reduit ? 1 : 3;
    }

    public function landlordNoticeMonths(array $jurisdictionData): int
    {
        return 6;
    }

    public function nextRevisionDate(CarbonImmutable $startsOn, ?CarbonImmutable $lastRevisionOn, array $jurisdictionData): ?CarbonImmutable
    {
        return FrFields::annualRevision($startsOn, $lastRevisionOn, $jurisdictionData);
    }
}
