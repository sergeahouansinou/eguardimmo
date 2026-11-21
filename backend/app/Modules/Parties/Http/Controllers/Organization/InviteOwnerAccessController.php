<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Actions\InviteOwnerAccess;
use App\Modules\Parties\Http\Requests\InviteOwnerAccessRequest;
use App\Modules\Parties\Http\Resources\OwnerIssuedInvitationResource;
use App\Modules\Parties\Queries\Parties;
use Illuminate\Http\JsonResponse;

final class InviteOwnerAccessController
{
    public function __invoke(string $party, InviteOwnerAccessRequest $request, Parties $parties, InviteOwnerAccess $inviter): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $emise = $inviter->handle(
            $parties->get($party),
            $request->role(),
            $request->personPartyId(),
            $request->email(),
            $request->boolean('identity_verified'),
            $request->boolean('powers_verified'),
            $user->id,
        );

        return (new OwnerIssuedInvitationResource($emise))->response()->setStatusCode(201)->header('Cache-Control', 'no-store, private');
    }
}
