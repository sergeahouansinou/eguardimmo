<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\TenantInvitations;
use App\Modules\Parties\Http\Requests\TenantInvitationPreviewRequest;
use App\Modules\Parties\Http\Resources\TenantInvitationPreviewResource;

final class PreviewTenantInvitationController
{
    public function __invoke(TenantInvitationPreviewRequest $request, TenantInvitations $invitations): TenantInvitationPreviewResource
    {
        /** @var User $user */
        $user = $request->user();

        return new TenantInvitationPreviewResource($invitations->preview($user->id, (string) $request->string('token')));
    }
}
