<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Actions\AcceptTenantInvitation;
use App\Modules\Parties\Http\Requests\AcceptTenantInvitationRequest;
use Illuminate\Http\JsonResponse;

final class AcceptTenantInvitationController
{
    public function __invoke(AcceptTenantInvitationRequest $request, AcceptTenantInvitation $accepter): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $lien = $accepter->handle($user->id, (string) $request->string('token'), $request->boolean('consent'));

        return new JsonResponse(['data' => ['tenant_link_id' => $lien->partyId]], 201);
    }
}
