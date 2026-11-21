<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Actions\AcceptOwnerInvitation;
use App\Modules\Parties\Http\Requests\AcceptOwnerInvitationRequest;
use Illuminate\Http\JsonResponse;

final class AcceptOwnerInvitationController
{
    public function __invoke(AcceptOwnerInvitationRequest $request, AcceptOwnerInvitation $accepter): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $lien = $accepter->handle($user->id, (string) $request->string('token'), (string) $request->string('code'), $request->boolean('consent'));

        return new JsonResponse(['data' => [
            'owner_link_id' => $lien->accessId,
            'role' => $lien->role->value,
            'organization' => ['id' => $lien->organizationId, 'name' => $lien->organizationName],
        ]], 201);
    }
}
