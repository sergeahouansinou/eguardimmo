<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\VerifyTwoFactorCode;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Http\Requests\TwoFactorCodeRequest;
use App\Modules\Identity\Models\User;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

final class ReauthenticateWithTwoFactorController
{
    public function __invoke(TwoFactorCodeRequest $request, VerifyTwoFactorCode $verification): Response
    {
        /** @var User $user */
        $user = $request->user();

        if (! $verification->handle($user, $request->code(), $request->recoveryCode(), enSession: true)) {
            throw ValidationException::withMessages(['code' => ['Code invalide.']]);
        }

        $request->session()->put(EnsureRecentReauthentication::CLE_2FA, now()->getTimestamp());
        $request->session()->put(EnsureRecentReauthentication::CLE_METHODE_2FA, $request->recoveryCode() === null ? EnsureRecentReauthentication::METHODE_TOTP : EnsureRecentReauthentication::METHODE_SECOURS);

        return response()->noContent();
    }
}
