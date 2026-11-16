<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\VerifyEmailFromLink;
use App\Modules\Identity\Enums\ErrorCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class VerifyEmailFromLinkController
{
    public const MESSAGE = 'Adresse e-mail vérifiée. Vous pouvez vous connecter.';

    public function __invoke(Request $request, string $id, string $hash, VerifyEmailFromLink $verifier): JsonResponse
    {
        if (! $request->hasValidSignature()) {
            throw ErrorCode::EmailVerificationLinkInvalid->problem();
        }

        $verifier->handle($id, $hash);

        return new JsonResponse(['message' => self::MESSAGE]);
    }
}
