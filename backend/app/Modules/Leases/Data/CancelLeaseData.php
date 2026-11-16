<?php

declare(strict_types=1);

namespace App\Modules\Leases\Data;

final readonly class CancelLeaseData
{
    public function __construct(public int $lockVersion) {}
}
