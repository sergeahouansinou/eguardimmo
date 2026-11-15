<?php

declare(strict_types=1);

namespace App\Modules\Parties\Enums;

enum IdentifierScheme: string
{
    case Siren = 'siren';
    case Siret = 'siret';
    case Vat = 'vat';
    case Neq = 'neq';
    case Bce = 'bce';
    case RcsLu = 'rcs_lu';
    case NationalId = 'national_id';
    case Passport = 'passport';
    case ResidencePermit = 'residence_permit';
    case TaxId = 'tax_id';

    public function isPersonal(): bool
    {
        return match ($this) {
            self::NationalId, self::Passport, self::ResidencePermit, self::TaxId => true,
            default => false,
        };
    }

    public function pattern(): string
    {
        return match ($this) {
            self::Siren => '/^\d{9}$/D',
            self::Siret => '/^\d{14}$/D',
            self::Neq, self::Bce => '/^\d{10}$/D',
            self::Vat => '/^[A-Z]{2}[A-Z0-9]{2,12}$/D',
            default => '/^[A-Z0-9]{3,40}$/D',
        };
    }

    public static function normalize(string $value): string
    {
        return strtoupper((string) preg_replace('/[\s.\-]+/', '', $value));
    }
}
