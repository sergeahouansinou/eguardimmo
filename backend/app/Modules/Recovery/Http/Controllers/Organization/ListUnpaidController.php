<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Http\Requests\ListUnpaidRequest;
use App\Modules\Recovery\Http\Resources\UnpaidPageResource;
use App\Modules\Recovery\Queries\UnpaidReceivables;
use Carbon\CarbonImmutable;

final class ListUnpaidController
{
    public function __invoke(ListUnpaidRequest $request, UnpaidReceivables $impayes): UnpaidPageResource
    {
        $today = CarbonImmutable::today();

        return new UnpaidPageResource($impayes->page($today, $request->leaseId(), $request->afterId(), $request->perPage()), $today);
    }
}
