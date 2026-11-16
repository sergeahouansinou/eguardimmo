<?php

declare(strict_types=1);

namespace App\Modules\Leases\Jurisdictions\Fr;

use App\Modules\Leases\Jurisdictions\RegimeField;
use Carbon\CarbonImmutable;

final class FrFields
{
    public const array ENERGY_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

    public const array REDUCED_NOTICE_REASONS = [
        'first_employment', 'transfer', 'job_loss', 'health', 'domestic_violence', 'minimum_income', 'social_housing',
    ];

    public static function revisionIndex(): RegimeField
    {
        return RegimeField::choice('revision_index', ['irl']);
    }

    public static function irlReferenceQuarter(): RegimeField
    {
        return RegimeField::text('irl_reference_quarter', '/^\d{4}-T[1-4]$/');
    }

    public static function tenseZone(): RegimeField
    {
        return RegimeField::boolean('tense_zone');
    }

    public static function rentControl(): RegimeField
    {
        return RegimeField::boolean('rent_control');
    }

    public static function energyClass(): RegimeField
    {
        return RegimeField::choice('energy_class', self::ENERGY_CLASSES);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function flag(array $data, string $key): bool
    {
        return filter_var($data[$key] ?? false, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function revisionExcluded(array $data): bool
    {
        return in_array($data['energy_class'] ?? null, ['F', 'G'], true);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function annualRevision(CarbonImmutable $startsOn, ?CarbonImmutable $lastRevisionOn, array $data): ?CarbonImmutable
    {
        if (self::revisionExcluded($data)) {
            return null;
        }

        return ($lastRevisionOn ?? $startsOn)->addYearsNoOverflow(1);
    }
}
