<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class LeaseChangesData
{
    public const array DRAFT_ONLY = ['jurisdiction', 'regime_key', 'starts_on', 'duration_months', 'tacit_renewal', 'due_day', 'periodicity', 'billing_timing', 'jurisdiction_data'];

    public const array ALWAYS = ['note', 'payment_method'];

    /**
     * @param  array<string, mixed>  $fields  colonnes transmises seulement : DRAFT_ONLY et ALWAYS ; `periodicity`, `billing_timing` et `payment_method` sont des enums
     * @param  array<string, mixed>|null  $customFields  null : inchangés
     * @param  list<NewLeaseUnitData>|null  $units  null : inchangés
     * @param  list<NewLeasePartyData>|null  $parties  null : inchangées
     * @param  list<NewLeaseTermData>|null  $terms  null : inchangées
     */
    public function __construct(
        public int $lockVersion,
        public array $fields,
        public ?array $customFields,
        public ?array $units,
        public ?array $parties,
        public ?array $terms,
    ) {}

    public function touchesDraftOnly(): bool
    {
        return array_intersect(array_keys($this->fields), self::DRAFT_ONLY) !== [] || $this->units !== null || $this->parties !== null || $this->terms !== null;
    }
}
