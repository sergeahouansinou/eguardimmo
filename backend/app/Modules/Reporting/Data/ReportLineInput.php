<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Data;

use App\Modules\Reporting\Enums\LineDirection;
use App\Modules\Reporting\Enums\LineKind;

final readonly class ReportLineInput
{
    /**
     * @param  string  $date  Y-m-d
     * @param  int  $amount  unités mineures, positif
     */
    public function __construct(
        public LineKind $kind,
        public string $date,
        public ?string $unitId,
        public ?string $leaseId,
        public ?string $mandateId,
        public string $label,
        public int $amount,
        public LineDirection $direction,
        public ?string $sourceType,
        public ?string $sourceId,
    ) {}

    public function withMandate(?string $mandateId): self
    {
        return new self($this->kind, $this->date, $this->unitId, $this->leaseId, $mandateId, $this->label, $this->amount, $this->direction, $this->sourceType, $this->sourceId);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'kind' => $this->kind->value,
            'date' => $this->date,
            'unit_id' => $this->unitId,
            'lease_id' => $this->leaseId,
            'mandate_id' => $this->mandateId,
            'label' => $this->label,
            'amount' => $this->amount,
            'direction' => $this->direction->value,
            'source_type' => $this->sourceType,
            'source_id' => $this->sourceId,
        ];
    }
}
