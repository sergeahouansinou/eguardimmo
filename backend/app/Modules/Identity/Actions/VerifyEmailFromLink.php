<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\DB;

final readonly class VerifyEmailFromLink
{
    public function handle(string $id, string $hash): void
    {
        // Même exception pour un compte inconnu, un hash faux ou une adresse déjà confirmée : aucune énumération.
        DB::transaction(function () use ($id, $hash): void {
            $user = User::query()->whereKey($id)->lockForUpdate()->first();

            if ($user === null || ! hash_equals(hash('sha1', $user->getEmailForVerification()), $hash) || $user->hasVerifiedEmail()) {
                throw ErrorCode::EmailVerificationLinkInvalid->problem();
            }

            $user->markEmailAsVerified();

            // Dans la transaction : si un listener échoue, l'adresse reste non vérifiée et le lien reste utilisable.
            event(new Verified($user));
        });
    }
}
