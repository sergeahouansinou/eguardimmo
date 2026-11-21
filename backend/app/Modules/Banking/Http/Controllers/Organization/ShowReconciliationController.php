<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Controllers\Organization;

use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Http\Resources\BankReconciliationResource;
use App\Modules\Banking\Models\BankReconciliation;

final class ShowReconciliationController
{
    public function __invoke(string $reconciliation): BankReconciliationResource
    {
        return new BankReconciliationResource(BankReconciliation::query()->find($reconciliation) ?? throw ErrorCode::ReconciliationNotFound->problem());
    }
}
