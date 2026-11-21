<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Actions\InviteTenantAccount;
use App\Modules\Parties\Http\Requests\InviteTenantAccountRequest;
use App\Modules\Parties\Http\Resources\TenantAccessResource;
use App\Modules\Parties\Queries\Parties;
use App\Modules\Parties\Queries\TenantAccesses;
use Illuminate\Http\JsonResponse;

final class InviteTenantAccountController
{
    public function __invoke(string $party, InviteTenantAccountRequest $request, Parties $parties, InviteTenantAccount $inviter, TenantAccesses $acces): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $partie = $parties->get($party);
        $inviter->handle($partie, $request->email(), $user->id);

        return (new TenantAccessResource($acces->of($partie)))->response()->setStatusCode(201);
    }
}
