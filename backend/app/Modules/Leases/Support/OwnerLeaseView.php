<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Mandates\Data\OwnerVisibleData;

final readonly class OwnerLeaseView
{
    /**
     * @param  list<string>  $tenantPartyIds  locataires seulement : ni garant, ni occupant
     */
    public function __construct(
        public LeaseView $view,
        public ?string $agencyName,
        public ?OwnerVisibleData $visible,
        public array $tenantPartyIds,
        public OwnerLeaseScope $scope,
    ) {}
}
