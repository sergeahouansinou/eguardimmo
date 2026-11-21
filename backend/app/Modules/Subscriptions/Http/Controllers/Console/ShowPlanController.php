<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Http\Controllers\Console;

use App\Modules\Subscriptions\Http\Resources\Console\PlanResource;
use App\Modules\Subscriptions\Queries\Plans;

final class ShowPlanController
{
    public function __invoke(string $plan, Plans $plans): PlanResource
    {
        return new PlanResource($plans->find($plan));
    }
}
