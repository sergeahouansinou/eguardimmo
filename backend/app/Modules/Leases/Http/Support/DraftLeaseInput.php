<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Support;

use App\Modules\Leases\Data\NewLeasePartyData;
use App\Modules\Leases\Data\NewLeaseTermData;
use App\Modules\Leases\Data\NewLeaseUnitData;
use App\Modules\Leases\Enums\LeasePartyRole;
use Illuminate\Validation\Rule;

/**
 * Règles et conversion des lots, parties et composantes d'un brouillon, communes à la création et à la modification.
 */
final class DraftLeaseInput
{
    /**
     * @return array<string, list<mixed>>
     */
    public static function rules(): array
    {
        return [
            'units.*.unit_id' => ['required', 'uuid', 'distinct'],
            'units.*.is_main' => ['required', 'boolean'],
            'parties' => ['array', 'max:30'],
            'parties.*.party_id' => ['required', 'uuid'],
            'parties.*.role' => ['required', Rule::enum(LeasePartyRole::class)],
            'parties.*.joint_liability' => ['sometimes', 'boolean'],
            'parties.*.guarantees_party_id' => ['nullable', 'uuid'],
            'parties.*.guarantee_limit_amount' => ['nullable', 'integer', 'min:1', 'max:999999999999'],
            'parties.*.guarantee_ends_on' => ['nullable', 'date_format:Y-m-d'],
            'terms' => ['array', 'max:30'],
            'terms.*.component_term_id' => ['required', 'uuid', 'distinct'],
            'terms.*.amount' => ['required', 'integer', 'min:0', 'max:999999999999'],
            'terms.*.vat_bp' => ['sometimes', 'integer', 'between:0,10000'],
            'terms.*.indexed' => ['sometimes', 'boolean'],
            'terms.*.valid_from' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @param  array<string, mixed>  $valides
     * @return list<NewLeaseUnitData>
     */
    public static function units(array $valides): array
    {
        return array_map(
            fn (array $ligne): NewLeaseUnitData => new NewLeaseUnitData((string) $ligne['unit_id'], (bool) $ligne['is_main']),
            self::lignes($valides, 'units'),
        );
    }

    /**
     * @param  array<string, mixed>  $valides
     * @return list<NewLeasePartyData>
     */
    public static function parties(array $valides): array
    {
        return array_map(fn (array $ligne): NewLeasePartyData => new NewLeasePartyData(
            partyId: (string) $ligne['party_id'],
            role: LeasePartyRole::from((string) $ligne['role']),
            jointLiability: (bool) ($ligne['joint_liability'] ?? false),
            guaranteesPartyId: isset($ligne['guarantees_party_id']) ? (string) $ligne['guarantees_party_id'] : null,
            guaranteeLimitAmount: isset($ligne['guarantee_limit_amount']) ? (int) $ligne['guarantee_limit_amount'] : null,
            guaranteeEndsOn: isset($ligne['guarantee_ends_on']) ? (string) $ligne['guarantee_ends_on'] : null,
        ), self::lignes($valides, 'parties'));
    }

    /**
     * @param  array<string, mixed>  $valides
     * @return list<NewLeaseTermData>
     */
    public static function terms(array $valides): array
    {
        return array_map(fn (array $ligne): NewLeaseTermData => new NewLeaseTermData(
            componentTermId: (string) $ligne['component_term_id'],
            amount: (int) $ligne['amount'],
            vatBp: (int) ($ligne['vat_bp'] ?? 0),
            indexed: (bool) ($ligne['indexed'] ?? false),
            validFrom: isset($ligne['valid_from']) ? (string) $ligne['valid_from'] : null,
        ), self::lignes($valides, 'terms'));
    }

    /**
     * @param  array<string, mixed>  $valides
     * @return list<array<string, mixed>>
     */
    private static function lignes(array $valides, string $cle): array
    {
        /** @var list<array<string, mixed>> */
        return array_values(array_filter((array) ($valides[$cle] ?? []), is_array(...)));
    }
}
