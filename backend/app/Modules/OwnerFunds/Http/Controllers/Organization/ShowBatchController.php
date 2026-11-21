<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Modules\OwnerFunds\Http\Resources\PayoutBatchResource;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use Illuminate\Support\Str;

final class ShowBatchController
{
    public function __invoke(string $batch): PayoutBatchResource
    {
        $lot = (Str::isUuid($batch) ? PayoutBatch::query()->whereKey($batch)->first() : null) ?? throw ErrorCode::BatchNotFound->problem();

        return new PayoutBatchResource($lot->load('items'));
    }
}
