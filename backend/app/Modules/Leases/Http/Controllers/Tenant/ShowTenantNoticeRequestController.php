<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Http\Resources\Tenant\TenantNoticeRequestResource;
use App\Modules\Leases\Queries\TenantNoticeRequests;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class ShowTenantNoticeRequestController
{
    public function __invoke(string $noticeRequest, Request $request, TenantNoticeRequests $demandes): TenantNoticeRequestResource
    {
        /** @var User $user */
        $user = $request->user();

        return new TenantNoticeRequestResource($demandes->find($user->id, $noticeRequest, CarbonImmutable::today()) ?? throw ErrorCode::NoticeRequestNotFound->problem());
    }
}
