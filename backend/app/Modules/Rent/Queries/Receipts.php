<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Models\RentReceipt;
use Illuminate\Support\Str;

final readonly class Receipts
{
    public function get(string $id): RentReceipt
    {
        return (Str::isUuid($id) ? RentReceipt::query()->find($id) : null) ?? throw ErrorCode::ReceiptNotFound->problem();
    }
}
