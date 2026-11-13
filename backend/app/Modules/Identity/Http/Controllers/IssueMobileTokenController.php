<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\AttemptPasswordLogin;
use App\Modules\Identity\Actions\StartMobileSession;
use App\Modules\Identity\Enums\LoginChannel;
use App\Modules\Identity\Http\Requests\MobileTokenRequest;
use App\Modules\Identity\Http\Resources\MobileLoginResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

final class IssueMobileTokenController
{
    public function __invoke(MobileTokenRequest $request, AttemptPasswordLogin $connexion, StartMobileSession $session): JsonResponse
    {
        $user = $connexion->handle((string) $request->string('email'), (string) $request->string('password'), LoginChannel::Mobile);

        if ($user === null) {
            throw ValidationException::withMessages(['email' => [__('auth.failed')]]);
        }

        return (new MobileLoginResource($session->handle($user, (string) $request->string('device_name'))))->response()->setStatusCode(201);
    }
}
