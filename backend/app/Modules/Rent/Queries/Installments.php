<?php

declare(strict_types=1);

namespace App\Modules\Rent\Queries;

use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Models\Installment;
use Illuminate\Support\Str;

final readonly class Installments
{
    public function get(string $id): Installment
    {
        return (Str::isUuid($id) ? Installment::query()->with(['lines', 'notice', 'receipt'])->find($id) : null) ?? throw ErrorCode::InstallmentNotFound->problem();
    }
}
