<?php

declare(strict_types=1);

namespace App\Modules\Banking\Enums;

enum SuggestionRule: string
{
    case Reference = 'reference';
    case ExistingEntry = 'existing_entry';
    case KnownCounterparty = 'known_counterparty';
    case Name = 'name';
    case OrganizationRule = 'organization_rule';
    case AmountOnly = 'amount_only';

    public function order(): int
    {
        return match ($this) {
            self::Reference => 1,
            self::ExistingEntry => 2,
            self::KnownCounterparty => 3,
            self::Name => 4,
            self::OrganizationRule => 5,
            self::AmountOnly => 6,
        };
    }
}
