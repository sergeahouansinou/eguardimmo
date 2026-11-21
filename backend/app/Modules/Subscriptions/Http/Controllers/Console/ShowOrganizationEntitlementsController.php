<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Http\Controllers\Console;

use App\Modules\Subscriptions\Queries\OrganizationEntitlementView;
use Illuminate\Http\JsonResponse;

final class ShowOrganizationEntitlementsController
{
    public function __invoke(string $organization, OrganizationEntitlementView $vue): JsonResponse
    {
        return new JsonResponse(['data' => $vue->of($organization)]);
    }
}
