<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Http\Controllers\Console;

use App\Modules\Subscriptions\Actions\UpdatePlanVersion;
use App\Modules\Subscriptions\Http\Requests\UpdatePlanVersionRequest;
use App\Modules\Subscriptions\Http\Resources\Console\PlanVersionResource;
use App\Modules\Subscriptions\Queries\Plans;

final class UpdatePlanVersionController
{
    public function __invoke(UpdatePlanVersionRequest $requete, string $version, Plans $plans, UpdatePlanVersion $action): PlanVersionResource
    {
        return new PlanVersionResource($action->handle($plans->version($version), $requete->changes(), (string) $requete->user()?->getAuthIdentifier()));
    }
}
