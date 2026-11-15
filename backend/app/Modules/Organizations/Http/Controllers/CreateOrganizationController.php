<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Actions\CreateOrganization;
use App\Modules\Organizations\Http\Requests\CreateOrganizationRequest;
use App\Modules\Organizations\Http\Resources\OrganizationResource;
use Illuminate\Http\JsonResponse;

final class CreateOrganizationController
{
    public function __invoke(CreateOrganizationRequest $request, CreateOrganization $creer): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $organisation = $creer->handle($user, $request->toData(), trim((string) $request->string('first_name')), trim((string) $request->string('last_name')));

        return (new OrganizationResource($organisation))->response()->setStatusCode(201);
    }
}
