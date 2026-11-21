<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Data;

use App\Modules\Maintenance\Enums\QuoteKind;

final readonly class QuoteInputData
{
    /**
     * @param  list<array{label: string, quantity_milli: int, unit: string|null, unit_price: int, tax_rate_key: string}>  $lines
     */
    public function __construct(
        public string $reference,
        public QuoteKind $kind,
        public string $issuedOn,
        public ?string $validUntil,
        public ?string $proposedOn,
        public ?string $message,
        public string $fileId,
        public array $lines,
        public ?int $declaredGross,
    ) {}
}
