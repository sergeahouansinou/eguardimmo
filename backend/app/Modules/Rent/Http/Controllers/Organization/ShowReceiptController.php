<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Controllers\Organization;

use App\Modules\Rent\Http\Resources\ReceiptResource;
use App\Modules\Rent\Queries\Receipts;

final class ShowReceiptController
{
    public function __invoke(string $receipt, Receipts $quittances): ReceiptResource
    {
        return new ReceiptResource($quittances->get($receipt), detail: true);
    }
}
