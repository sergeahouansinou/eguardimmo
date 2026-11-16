<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class EndLeasePartyData
{
    /**
     * @param  string  $validTo  Y-m-d, exclu : la partie n'est plus au bail à partir de ce jour
     */
    public function __construct(
        public int $lockVersion,
        public string $validTo,
    ) {}
}
