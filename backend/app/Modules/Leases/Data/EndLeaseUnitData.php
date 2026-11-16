<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class EndLeaseUnitData
{
    /**
     * @param  string  $validTo  Y-m-d, premier jour où le lot n'est plus occupé (exclu)
     * @param  string|null  $replaceWithUnitId  lot qui devient principal à partir de $validTo ; obligatoire pour fermer le lot principal
     */
    public function __construct(
        public int $lockVersion,
        public string $validTo,
        public ?string $replaceWithUnitId = null,
    ) {}
}
