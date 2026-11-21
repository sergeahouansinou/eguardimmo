<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Http\Controllers\Console;

use App\Modules\Subscriptions\Actions\CreatePlanVersion;
use App\Modules\Subscriptions\Http\Resources\Console\PlanVersionResource;
use App\Modules\Subscriptions\Queries\Plans;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CreatePlanVersionController
{
    public function __invoke(Request $requete, string $plan, Plans $plans, CreatePlanVersion $action): JsonResponse
    {
        $version = $action->handle($plans->find($plan), (string) $requete->user()?->getAuthIdentifier());

        return (new PlanVersionResource($version))->response()->setStatusCode(201);
    }
}
