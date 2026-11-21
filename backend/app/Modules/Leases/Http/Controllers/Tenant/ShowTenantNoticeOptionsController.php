<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Http\Resources\Tenant\TenantNoticeOptionsResource;
use App\Modules\Leases\Queries\NoticeOptions;
use App\Modules\Leases\Queries\TenantStandings;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class ShowTenantNoticeOptionsController
{
    public function __invoke(string $lease, Request $request, TenantStandings $positions, NoticeOptions $options): TenantNoticeOptionsResource
    {
        /** @var User $user */
        $user = $request->user();
        $aujourdhui = CarbonImmutable::today();
        $position = $positions->find($user->id, $lease, $aujourdhui) ?? throw ErrorCode::LeaseNotFound->problem();

        return new TenantNoticeOptionsResource($options->forTenant($position, $aujourdhui));
    }
}
