<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\ConfirmEmailChange;
use App\Modules\Identity\Http\Requests\ConfirmEmailChangeRequest;
use App\Modules\Identity\Http\Resources\UserResource;
use App\Modules\Identity\Models\User;

final class ConfirmEmailChangeController
{
    public function __invoke(ConfirmEmailChangeRequest $request, ConfirmEmailChange $action): UserResource
    {
        /** @var User $user */
        $user = $request->user();
        $session = $request->hasSession() ? $request->session()->getId() : null;

        return new UserResource($action->handle($user, (string) $request->validated('code'), $session));
    }
}
