<?php

declare(strict_types=1);

namespace App\Modules\Identity\Fortify;

use Illuminate\Http\JsonResponse;
use Laravel\Fortify\Contracts\FailedPasswordResetLinkRequestResponse;
use Laravel\Fortify\Contracts\SuccessfulPasswordResetLinkRequestResponse;

final class PasswordResetLinkRequestedResponse implements FailedPasswordResetLinkRequestResponse, SuccessfulPasswordResetLinkRequestResponse
{
    public const MESSAGE = 'Si un compte correspond à cette adresse, un e-mail vient de lui être envoyé.';

    public function toResponse($request): JsonResponse
    {
        return new JsonResponse(['message' => self::MESSAGE], 202);
    }
}
