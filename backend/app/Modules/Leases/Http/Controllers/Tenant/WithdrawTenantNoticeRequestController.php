<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Actions\WithdrawNoticeRequest;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Http\Resources\Tenant\TenantNoticeRequestResource;
use App\Modules\Leases\Queries\TenantNoticeRequests;
use App\Modules\Leases\Support\ProofContexts;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class WithdrawTenantNoticeRequestController
{
    public function __invoke(string $noticeRequest, Request $request, TenantNoticeRequests $demandes, ProofContexts $contextes, WithdrawNoticeRequest $action): TenantNoticeRequestResource
    {
        /** @var User $user */
        $user = $request->user();
        $demande = $demandes->find($user->id, $noticeRequest, CarbonImmutable::today()) ?? throw ErrorCode::NoticeRequestNotFound->problem();

        return new TenantNoticeRequestResource($action->handle($demande->organization_id, $demande->id, $user, $contextes->of($request)));
    }
}
