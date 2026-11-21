<?php

declare(strict_types=1);

namespace App\Modules\Leases\Jurisdictions\Fr;

use App\Modules\Leases\Jurisdictions\LeaseRegime;
use App\Modules\Leases\Jurisdictions\RegimeField;
use Carbon\CarbonImmutable;

final class CommonLawRegime implements LeaseRegime
{
    public const string KEY = 'fr.common_law';

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
        return 'Droit commun (parking ou garage seul)';
    }

    public function currency(): string
    {
        return 'EUR';
    }

    public function jurisdictionDataFields(): array
    {
        return [];
    }

    public function jurisdictionDataRules(): array
    {
        return RegimeField::rulesOf($this->jurisdictionDataFields());
    }

    public function defaultDurationMonths(array $jurisdictionData): int
    {
        return 12;
    }

    public function minimumDurationMonths(array $jurisdictionData): int
    {
        return 1;
    }

    public function maximumDurationMonths(array $jurisdictionData): ?int
    {
        return null;
    }

    public function tacitRenewal(array $jurisdictionData): bool
    {
        return false;
    }

    public function renewalMonths(array $jurisdictionData): ?int
    {
        return null;
    }

    public function depositCapMonths(array $jurisdictionData): ?int
    {
        return null;
    }

    public function tenantNoticeMonths(array $jurisdictionData): ?int
    {
        return null;
    }

    public function tenantNoticeReasons(array $jurisdictionData): array
    {
        return [];
    }

    public function tenantEarliestDeparture(array $jurisdictionData, CarbonImmutable $receivedOn, string $reasonKey): CarbonImmutable
    {
        return FrFields::earliestDeparture($this->tenantNoticeReasons($jurisdictionData), $receivedOn, $reasonKey);
    }

    public function landlordNoticeMonths(array $jurisdictionData): ?int
    {
        return null;
    }

    public function nextRevisionDate(CarbonImmutable $startsOn, ?CarbonImmutable $lastRevisionOn, array $jurisdictionData): ?CarbonImmutable
    {
        return null;
    }
}
