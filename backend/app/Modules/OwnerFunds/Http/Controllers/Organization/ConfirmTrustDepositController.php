<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Organization;

use App\Modules\OwnerFunds\Actions\ConfirmTrustDeposit;
use App\Modules\OwnerFunds\Http\Resources\TrustDepositResource;
use App\Modules\OwnerFunds\Support\Actor;
use App\Modules\OwnerFunds\Support\IdempotencyHeader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ConfirmTrustDepositController
{
    public function __invoke(Request $request, string $deposit, ConfirmTrustDeposit $apport): JsonResponse
    {
        $resultat = $apport->handle($deposit, IdempotencyHeader::read($request), Actor::id($request));

        return (new TrustDepositResource($resultat['deposit']))->response();
    }
}
