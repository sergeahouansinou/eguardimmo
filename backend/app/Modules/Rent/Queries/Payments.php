<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Models\Payment;
use Illuminate\Support\Str;

final readonly class Payments
{
    public function get(string $id): Payment
    {
        return (Str::isUuid($id) ? Payment::query()->with('allocations')->find($id) : null) ?? throw ErrorCode::PaymentNotFound->problem();
    }
}
