<?php

declare(strict_types=1);

namespace App\Modules\Investments\Data;

use Illuminate\Http\UploadedFile;

final readonly class NewAcquisitionData
{
    public function __construct(
        public string $propertyId,
        public ?string $unitId,
        public string $acquiredOn,
        public int $price,
        public int $acquisitionCosts,
        public int $agencyFees,
        public int $initialWorks,
        public ?UploadedFile $document,
        public string $idempotencyKey,
    ) {}

    /**
     * @return list<int|string|null>
     */
    public function content(): array
    {
        return [$this->propertyId, $this->unitId, $this->acquiredOn, $this->price, $this->acquisitionCosts, $this->agencyFees, $this->initialWorks];
    }
}
