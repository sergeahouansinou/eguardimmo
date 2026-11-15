<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\CheckPasswordResetToken;
use App\Modules\Identity\Http\Requests\PasswordResetStatusRequest;
use Illuminate\Http\JsonResponse;

final class ShowPasswordResetStatusController
{
    public function __invoke(PasswordResetStatusRequest $request, CheckPasswordResetToken $verification): JsonResponse
    {
        $valide = $verification->handle((string) $request->string('email'), (string) $request->string('token'));

        return new JsonResponse(['data' => ['status' => $valide ? 'valid' : 'expired']]);
    }
}
