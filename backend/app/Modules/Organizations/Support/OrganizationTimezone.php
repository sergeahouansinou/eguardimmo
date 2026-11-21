<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use DateTimeZone;
use LogicException;

final class OrganizationTimezone
{
    public const string FALLBACK = 'Europe/Paris';

    public const array DEFAULTS = [
        'FR' => 'Europe/Paris',
        'BE' => 'Europe/Brussels',
        'LU' => 'Europe/Luxembourg',
        'CA' => 'America/Toronto',
    ];

    public static function defaultFor(string $country): string
    {
        return self::DEFAULTS[$country] ?? throw new LogicException("Fuseau inconnu pour le pays {$country}.");
    }

    public static function isValid(string $timezone): bool
    {
        return in_array($timezone, DateTimeZone::listIdentifiers(), true);
    }
}
