<?php

declare(strict_types=1);

namespace App\Modules\Charges\Data;

use App\Modules\Charges\Enums\ExpenseKind;
use App\Modules\Charges\Enums\ExpenseSettlement;
use Illuminate\Http\UploadedFile;

final readonly class ExpenseInputData
{
    /**
     * @param  string  $documentOn  Y-m-d
     * @param  string  $serviceFrom  Y-m-d
     * @param  string  $serviceTo  Y-m-d, exclu
     * @param  int  $totalGross  unités mineures de la devise de l'organisation
     * @param  ?string  $paidOn  Y-m-d
     */
    public function __construct(
        public string $propertyId,
        public ?string $unitId,
        public ExpenseKind $kind,
        public string $categoryTermId,
        public ?string $payeePartyId,
        public ?string $payeeLabel,
        public ?string $reference,
        public string $documentOn,
        public string $serviceFrom,
        public string $serviceTo,
        public int $totalGross,
        public int $taxAmount,
        public int $recoverableAmount,
        public ?string $recoverableRubric,
        public ExpenseSettlement $settlement,
        public ?string $paidOn,
        public ?UploadedFile $document,
        public string $idempotencyKey,
    ) {}
}
