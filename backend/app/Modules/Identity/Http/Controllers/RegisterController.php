<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\RegisterUser;
use App\Modules\Identity\Http\Requests\RegisterRequest;
use Illuminate\Http\JsonResponse;

final class RegisterController
{
    public const MESSAGE = 'Vérifiez vos e-mails pour finaliser votre inscription.';

    public function __invoke(RegisterRequest $request, RegisterUser $inscription): JsonResponse
    {
        $inscription->handle($request->toData());

        return new JsonResponse(['message' => self::MESSAGE], 202);
    }
}
