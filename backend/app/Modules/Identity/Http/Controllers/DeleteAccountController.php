<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\ConfirmAccountOwnership;
use App\Modules\Identity\Actions\DeleteAccount;
use App\Modules\Identity\Http\Requests\DeleteAccountRequest;
use App\Modules\Identity\Models\User;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

final class DeleteAccountController
{
    public function __invoke(DeleteAccountRequest $request, ConfirmAccountOwnership $confirmation, DeleteAccount $suppression): Response
    {
        /** @var User $user */
        $user = $request->user();

        $confirmation->handle($user, $request->toData());
        $suppression->handle($user);

        if ($request->hasSession()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->noContent();
    }
}
