<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\UpdatePhone;
use App\Modules\Identity\Http\Requests\UpdatePhoneRequest;
use App\Modules\Identity\Http\Resources\UserResource;
use App\Modules\Identity\Models\User;

final class UpdatePhoneController
{
    public function __invoke(UpdatePhoneRequest $request, UpdatePhone $action): UserResource
    {
        /** @var User $user */
        $user = $request->user();
        $phone = $request->validated('phone');

        return new UserResource($action->handle($user, is_string($phone) ? $phone : null));
    }
}
