<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Http\Controllers\Console;

use App\Modules\Subscriptions\Http\Resources\Console\PlanResource;
use App\Modules\Subscriptions\Queries\Plans;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListPlansController
{
    public function __invoke(Plans $plans): AnonymousResourceCollection
    {
        return PlanResource::collection($plans->all());
    }
}
