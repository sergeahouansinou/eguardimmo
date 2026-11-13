<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\CompleteTwoFactorChallenge;
use App\Modules\Identity\Data\MobileLoginResult;
use App\Modules\Identity\Http\Requests\TwoFactorCodeRequest;
use App\Modules\Identity\Http\Resources\MobileLoginResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

final class CompleteMobileTwoFactorController
{
    public function __invoke(TwoFactorCodeRequest $request, CompleteTwoFactorChallenge $defi): JsonResponse
    {
        $request->validate(['challenge' => ['required']]);

        $jeton = $defi->handle((string) $request->string('challenge'), $request->code(), $request->recoveryCode());

        if ($jeton === null) {
            throw ValidationException::withMessages(['code' => ['Code invalide ou défi expiré.']]);
        }

        return (new MobileLoginResource(MobileLoginResult::token($jeton)))->response()->setStatusCode(201);
    }
}
