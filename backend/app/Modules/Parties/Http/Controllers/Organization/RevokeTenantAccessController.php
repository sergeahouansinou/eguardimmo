<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Identity\Enums\TenantRevoker;
use App\Modules\Identity\Models\User;
use App\Modules\Parties\Actions\RevokeTenantAccess;
use App\Modules\Parties\Queries\Parties;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RevokeTenantAccessController
{
    public function __invoke(string $party, Request $request, Parties $parties, RevokeTenantAccess $revoquer): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $revoquer->handle($parties->get($party), TenantRevoker::Organization, $user->id);

        return new JsonResponse(null, 204);
    }
}
