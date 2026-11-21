<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Actions\RequestContactUpdate;
use App\Modules\Parties\Http\Requests\RequestContactUpdateRequest;
use App\Modules\Parties\Http\Resources\Tenant\TenantContactUpdateResource;
use Illuminate\Http\JsonResponse;

final class StoreTenantContactUpdateController
{
    public function __invoke(RequestContactUpdateRequest $request, RequestContactUpdate $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $resultat = $action->handle($user, (string) $request->validated('organization_id'), $request->fields(), strtolower((string) $request->validated('client_id')));

        return (new TenantContactUpdateResource($resultat['request']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
