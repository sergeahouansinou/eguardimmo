<?php

declare(strict_types=1);

namespace App\Modules\Investments\Data;

use App\Modules\Investments\Enums\LoanPurpose;
use Illuminate\Http\UploadedFile;

final readonly class NewLoanData
{
    public function __construct(
        public string $propertyId,
        public ?string $unitId,
        public string $lenderLabel,
        public ?string $contractReference,
        public LoanPurpose $purpose,
        public LoanTermsData $terms,
        public ?string $replacesLoanId,
        public ?UploadedFile $document,
        public string $idempotencyKey,
    ) {}

    /**
     * @return list<int|string|null>
     */
    public function content(): array
    {
        return [
            $this->propertyId, $this->unitId, $this->lenderLabel, $this->contractReference, $this->purpose->value, $this->replacesLoanId,
            $this->terms->principal, $this->terms->annualRate, $this->terms->firstDueOn, $this->terms->termMonths, $this->terms->deferralKind->value,
            $this->terms->deferralMonths, $this->terms->insuranceMode->value, $this->terms->insuranceRate, $this->terms->insuranceAmount,
        ];
    }
}
