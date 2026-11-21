<?php

declare(strict_types=1);

namespace App\Modules\Rent\Enums;

use App\Modules\Catalog\Enums\LeaseComponentSemantic;

/**
 * Sens d'une ligne d'échéance : ceux des composantes du bail, plus la régularisation de charges qui n'existe que sur
 * une échéance, jamais comme terme de bail (ADR 0020).
 */
enum LineSemantic: string
{
    case Rent = 'rent';
    case ChargesProvision = 'charges_provision';
    case ChargesFlat = 'charges_flat';
    case RentSupplement = 'rent_supplement';
    case Deposit = 'deposit';
    case TaxRecoverable = 'tax_recoverable';
    case ChargesAdjustment = 'charges_adjustment';

    public static function ofComponent(LeaseComponentSemantic $sens): self
    {
        return self::from($sens->value);
    }

    public function isRent(): bool
    {
        return $this === self::Rent || $this === self::RentSupplement;
    }
}
