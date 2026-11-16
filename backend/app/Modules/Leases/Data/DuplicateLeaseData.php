<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class DuplicateLeaseData
{
    /**
     * @param  string  $startsOn  Y-m-d
     */
    public function __construct(public string $startsOn) {}
}
