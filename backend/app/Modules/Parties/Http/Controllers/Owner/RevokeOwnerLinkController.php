<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Owner;

use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Identity\Models\User;
use App\Modules\Parties\Actions\RevokeOwnerAccess;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Queries\OwnerAccesses;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RevokeOwnerLinkController
{
    public function __invoke(string $access, Request $request, OwnerAccesses $acces, CurrentOrganization $contexte, RevokeOwnerAccess $revoquer): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $lien = $acces->activeOfUser($user->id, $access) ?? throw ErrorCode::OwnerAccessNotFound->problem();

        $contexte->run($lien->organization_id, fn () => $revoquer->handle($lien, OwnerRevoker::Account, $user->id));

        return new JsonResponse(null, 204);
    }
}
