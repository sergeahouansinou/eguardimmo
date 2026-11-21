<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Http\Resources\Tenant\TenantReportOptionResource;
use App\Modules\Maintenance\Queries\TenantReportOptions;
use App\Modules\Maintenance\Support\TenantAccess;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTenantReportOptionsController
{
    public function __invoke(Request $request, TenantAccess $acces, TenantReportOptions $options): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        return TenantReportOptionResource::collection($options->build($acces->keys($user->id), CarbonImmutable::today()));
    }
}
