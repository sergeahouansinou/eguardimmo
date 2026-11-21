<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

final readonly class SupplierInputData
{
    /**
     * @param  list<string>  $tradeTermIds
     * @param  array<string, mixed>|null  $customFields
     */
    public function __construct(
        public string $partyId,
        public array $tradeTermIds,
        public bool $preferred,
        public ?int $paymentTermsDays,
        public ?string $internalNote,
        public ?array $customFields,
    ) {}
}
