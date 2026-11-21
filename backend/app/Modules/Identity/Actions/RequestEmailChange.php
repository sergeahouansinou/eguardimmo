<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\EmailChangeRequest;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\EmailChangeAddressTakenNotification;
use App\Modules\Identity\Notifications\EmailChangeCodeNotification;
use App\Modules\Identity\Support\EmailChangeCodes;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

final readonly class RequestEmailChange
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Même issue visible dans tous les cas (adresse libre, déjà prise, identique à l'actuelle) : le code n'est envoyé qu'à une
     * adresse libre, et le titulaire d'une adresse prise est prévenu à part, sans énumération (ADR 0036).
     */
    public function handle(User $user, string $adresse): void
    {
        $email = Str::lower(trim($adresse));

        if ($email === Str::lower($user->email)) {
            return;
        }

        $titulaire = User::query()->where('email', $email)->first();

        if ($titulaire !== null) {
            $titulaire->notify(new EmailChangeAddressTakenNotification);

            return;
        }

        $code = EmailChangeCodes::generate();

        DB::transaction(function () use ($user, $email, $code): void {
            EmailChangeRequest::query()->where('user_id', $user->id)->whereNull('consumed_at')->update(['consumed_at' => now()]);
            EmailChangeRequest::query()->create([
                'user_id' => $user->id,
                'email' => $email,
                'email_hash' => EmailChangeCodes::emailHash($email),
                'code_hash' => EmailChangeCodes::hash($code),
                'expires_at' => now()->addMinutes(EmailChangeRequest::VALIDITY_MINUTES),
            ]);
            $this->audit->handle('identity.email_change.requested', $user->id);
        });

        Notification::route('mail', $email)->notify(new EmailChangeCodeNotification($code));
    }
}
