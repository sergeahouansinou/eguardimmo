<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Jurisdictions\Fr;

use App\Modules\OwnerFunds\Jurisdictions\OwnerFundsRules;

final class FrOwnerFundsRules implements OwnerFundsRules
{
    public function jurisdiction(): string
    {
        return 'FR';
    }

    public function payoutPrefix(): string
    {
        return 'RV';
    }

    public function payoutIbanCountries(): array
    {
        return ['FR', 'MC', 'BE', 'LU', 'DE', 'ES', 'IT', 'PT', 'NL', 'IE', 'AT', 'FI', 'GR', 'CH'];
    }
}
