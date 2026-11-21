<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Http\Resources\Owner\OwnerLeaseResource;
use App\Modules\Leases\Queries\OwnerLeases;
use App\Modules\Leases\Queries\OwnerLeaseViews;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class ShowOwnerLeaseController
{
    public function __invoke(string $lease, Request $request, MandateDirectory $mandats, OwnerLeases $baux, OwnerLeaseViews $vues): OwnerLeaseResource
    {
        /** @var User $user */
        $user = $request->user();
        $portee = $mandats->ownerScope($user->id);
        $bail = $baux->find($portee, $lease) ?? throw ErrorCode::OwnerLeaseNotFound->problem();

        return new OwnerLeaseResource($vues->detail($portee, $bail, CarbonImmutable::today()));
    }
}
