<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\ToggleBatchItem;
use App\Modules\OwnerFunds\Http\Requests\BatchVersionRequest;
use App\Modules\OwnerFunds\Http\Resources\PayoutBatchResource;
use Carbon\CarbonImmutable;

final class ExcludeBatchItemController
{
    public function __invoke(BatchVersionRequest $request, string $batch, string $item, ToggleBatchItem $bascule): PayoutBatchResource
    {
        return new PayoutBatchResource($bascule->handle($batch, $item, false, $request->lockVersion(), CarbonImmutable::today())->load('items'));
    }
}
