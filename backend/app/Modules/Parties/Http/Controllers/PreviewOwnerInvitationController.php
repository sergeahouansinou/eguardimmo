<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\OwnerInvitations;
use App\Modules\Parties\Http\Requests\OwnerInvitationPreviewRequest;
use App\Modules\Parties\Http\Resources\OwnerInvitationPreviewResource;

final class PreviewOwnerInvitationController
{
    public function __invoke(OwnerInvitationPreviewRequest $request, OwnerInvitations $invitations): OwnerInvitationPreviewResource
    {
        /** @var User $user */
        $user = $request->user();

        return new OwnerInvitationPreviewResource($invitations->preview($user->id, (string) $request->string('token')));
    }
}
