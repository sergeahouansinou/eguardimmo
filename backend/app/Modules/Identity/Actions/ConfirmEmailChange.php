<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\EmailChangeRequest;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\EmailChangedNotification;
use App\Modules\Identity\Support\EmailChangeCodes;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use SensitiveParameter;

final readonly class ConfirmEmailChange
{
    public function __construct(
        private RevokeUserCredentials $revoke,
        private RecordAudit $audit,
    ) {}

    /**
     * Code faux, expiré, adresse devenue indisponible ou aucune demande : même réponse. Chaque essai est compté avant la
     * comparaison, hors de la transaction finale, pour que l'échec ne l'annule pas.
     */
    public function handle(User $user, #[SensitiveParameter] string $code, ?string $sessionCourante): User
    {
        $demande = EmailChangeRequest::query()
            ->where('user_id', $user->id)->whereNull('consumed_at')->where('expires_at', '>', now())
            ->orderByDesc('id')->first() ?? throw ErrorCode::EmailChangeCodeInvalid->problem();

        $comptee = EmailChangeRequest::query()->whereKey($demande->id)->whereNull('consumed_at')->where('attempts', '<', EmailChangeRequest::MAX_ATTEMPTS)->increment('attempts');

        if ($comptee === 0) {
            throw ErrorCode::EmailChangeAttemptsExceeded->problem();
        }

        if (! hash_equals($demande->code_hash, EmailChangeCodes::hash($code))) {
            throw ErrorCode::EmailChangeCodeInvalid->problem();
        }

        $ancienne = $user->email;

        try {
            DB::transaction(function () use ($user, $demande): void {
                $verrouillee = EmailChangeRequest::query()->whereKey($demande->id)->lockForUpdate()->first();

                if ($verrouillee === null || $verrouillee->consumed_at !== null) {
                    throw ErrorCode::EmailChangeCodeInvalid->problem();
                }

                if (User::query()->where('email', $verrouillee->email)->whereKeyNot($user->id)->exists()) {
                    throw ErrorCode::EmailChangeCodeInvalid->problem();
                }

                $user->forceFill(['email' => $verrouillee->email, 'email_verified_at' => now()])->save();
                $verrouillee->forceFill(['consumed_at' => now()])->save();
                $this->audit->handle('identity.email_change.confirmed', $user->id);
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::EmailChangeCodeInvalid->problem();
        }

        $this->revoke->handle($user, 'email_changed', $sessionCourante);
        Notification::route('mail', $ancienne)->notify(new EmailChangedNotification);

        return $user->refresh();
    }
}
