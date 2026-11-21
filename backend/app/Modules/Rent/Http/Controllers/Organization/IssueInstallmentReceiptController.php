<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Actions\IssueReceipt;
use App\Modules\Rent\Http\Resources\ReceiptResource;
use App\Modules\Rent\Queries\Installments;
use Carbon\CarbonImmutable;

final class IssueInstallmentReceiptController
{
    public function __invoke(string $installment, Installments $echeances, IssueReceipt $emettre): ReceiptResource
    {
        $quittance = $emettre->handle($echeances->get($installment), CarbonImmutable::today());

        return new ReceiptResource($quittance ?? throw new \LogicException('Une demande explicite émet toujours la quittance.'), detail: true);
    }
}
