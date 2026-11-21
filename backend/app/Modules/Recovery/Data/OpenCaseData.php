<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Data;

final readonly class OpenCaseData
{
    /**
     * @param  list<string>  $installmentIds
     * @param  list<string>  $invoiceIds
     */
    public function __construct(
        public string $leaseId,
        public string $debtorPartyId,
        public array $installmentIds,
        public array $invoiceIds = [],
    ) {}
}
