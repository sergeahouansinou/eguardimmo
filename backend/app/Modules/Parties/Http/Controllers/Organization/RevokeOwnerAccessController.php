<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Actions\RevokeOwnerAccessOfMandant;
use App\Modules\Parties\Queries\Parties;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RevokeOwnerAccessController
{
    public function __invoke(string $party, string $access, Request $request, Parties $parties, RevokeOwnerAccessOfMandant $revoquer): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $revoquer->handle($parties->get($party), $access, $user->id);

        return new JsonResponse(null, 204);
    }
}
