<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Actions\AcceptInvitation;
use App\Modules\Organizations\Http\Requests\AcceptInvitationRequest;
use Illuminate\Http\JsonResponse;

final class AcceptInvitationController
{
    public function __invoke(AcceptInvitationRequest $request, AcceptInvitation $accepter): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $membre = $accepter->handle($user, (string) $request->string('token'));

        return new JsonResponse(['data' => ['organization_id' => $membre->organization_id, 'role' => $membre->role->value]]);
    }
}
