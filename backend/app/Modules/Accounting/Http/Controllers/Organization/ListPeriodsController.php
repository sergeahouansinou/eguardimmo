<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Http\Controllers\Organization;

use App\Modules\Accounting\Http\Resources\PeriodResource;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListPeriodsController
{
    public function __invoke(LedgerAggregates $agregats): AnonymousResourceCollection
    {
        return PeriodResource::collection($agregats->periods());
    }
}
