<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\RequestEmailChange;
use App\Modules\Identity\Http\Requests\RequestEmailChangeRequest;
use App\Modules\Identity\Models\User;
use Illuminate\Http\JsonResponse;

final class RequestEmailChangeController
{
    public function __invoke(RequestEmailChangeRequest $request, RequestEmailChange $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $action->handle($user, (string) $request->validated('email'));

        return response()->json(['data' => ['status' => 'code_sent', 'expires_in_minutes' => 15]], 202);
    }
}
