<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\ResendEmailVerification;
use App\Modules\Identity\Http\Requests\ResendEmailVerificationRequest;
use Illuminate\Http\JsonResponse;

final class ResendEmailVerificationController
{
    public const MESSAGE = 'Si un compte non vérifié correspond à cette adresse, un nouveau message vient de lui être envoyé.';

    public function __invoke(ResendEmailVerificationRequest $request, ResendEmailVerification $renvoi): JsonResponse
    {
        $renvoi->handle((string) $request->string('email'));

        return new JsonResponse(['message' => self::MESSAGE], 202);
    }
}
