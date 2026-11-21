<?php

declare(strict_types=1);

namespace App\Modules\Rent\Data;

use App\Modules\Rent\Enums\InstallmentStatus;

final readonly class InstallmentFilters
{
    /**
     * @param  ?string  $dueFrom  Y-m-d, jour compris
     * @param  ?string  $dueTo  Y-m-d, jour compris
     */
    public function __construct(
        public ?string $leaseId = null,
        public ?InstallmentStatus $status = null,
        public ?string $dueFrom = null,
        public ?string $dueTo = null,
        public bool $overdue = false,
        public ?string $cursor = null,
    ) {}
}
