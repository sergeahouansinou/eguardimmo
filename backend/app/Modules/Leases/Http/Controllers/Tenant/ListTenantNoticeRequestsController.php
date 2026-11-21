<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Http\Requests\ListCursorRequest;
use App\Modules\Leases\Http\Resources\Tenant\TenantNoticeRequestResource;
use App\Modules\Leases\Queries\TenantNoticeRequests;
use Carbon\CarbonImmutable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTenantNoticeRequestsController
{
    public function __invoke(ListCursorRequest $request, TenantNoticeRequests $demandes): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        return TenantNoticeRequestResource::collection($demandes->page($user->id, $request->perPage(), $request->cursor(), CarbonImmutable::today()));
    }
}
