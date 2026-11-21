<?php

declare(strict_types=1);

namespace App\Modules\Invoicing\Data;

use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;

final readonly class InvoiceFilters
{
    public function __construct(
        public ?InvoiceKind $kind = null,
        public ?InvoiceStatus $status = null,
        public ?int $year = null,
        public ?string $search = null,
        public bool $overdue = false,
        public ?string $recipientPartyId = null,
        public ?string $cursor = null,
    ) {}
}
