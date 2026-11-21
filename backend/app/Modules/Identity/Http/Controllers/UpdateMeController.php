<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\UpdateProfileName;
use App\Modules\Identity\Http\Requests\UpdateProfileRequest;
use App\Modules\Identity\Http\Resources\UserResource;
use App\Modules\Identity\Models\User;

final class UpdateMeController
{
    public function __invoke(UpdateProfileRequest $request, UpdateProfileName $action): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        return new UserResource($action->handle($user, (string) $request->validated('name')));
    }
}
