<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Data\ExpenseInputData;

final class ExpenseFingerprint
{
    public static function of(ExpenseInputData $d, string $currency): string
    {
        return Idempotency::fingerprint([
            $d->propertyId, $d->unitId, $d->kind->value, $d->categoryTermId, $d->payeePartyId, $d->payeeLabel === null ? null : mb_strtolower(trim($d->payeeLabel)),
            $d->reference === null ? null : mb_strtolower(trim($d->reference)), $d->documentOn, $d->serviceFrom, $d->serviceTo, $d->totalGross, $d->taxAmount,
            $d->recoverableAmount, $d->recoverableRubric, $d->settlement->value, $d->paidOn, $currency,
        ]);
    }
}
