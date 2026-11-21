<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use LogicException;
use Money\Currency;

final class OrganizationCurrency
{
    /**
     * Devise du siège : une juridiction ouverte à la facturation a une seule devise.
     */
    public static function of(string $country): Currency
    {
        return match ($country) {
            'FR', 'BE', 'LU' => new Currency('EUR'),
            'CA' => new Currency('CAD'),
            default => throw new LogicException("Devise inconnue pour le pays {$country}."),
        };
    }
}
