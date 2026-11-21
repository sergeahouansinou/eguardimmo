<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

final readonly class TenantLeaseView
{
    /**
     * @param  ?string  $accessUntil  Y-m-d, dernier jour d'accès compris ; null tant que l'occupation n'a pas de fin
     * @param  list<string>  $myPartyIds
     */
    public function __construct(
        public LeaseView $view,
        public ?string $organizationName,
        public ?string $accessUntil,
        public bool $inGrace,
        public array $myPartyIds,
    ) {}
}
