<?php

declare(strict_types=1);

namespace App\Modules\Identity\Jobs;

use App\Modules\Identity\Models\User;
use App\Shared\Audit\RecordAudit;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class SendEmailVerificationLink implements ShouldBeEncrypted, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(private readonly string $email) {}

    public function handle(RecordAudit $audit): void
    {
        $user = User::query()->where('email', $this->email)->first();

        if ($user === null || $user->hasVerifiedEmail()) {
            return;
        }

        $user->sendEmailVerificationNotification();
        $audit->handle('auth.email.verification.resent', $user->id, subject: $user);
    }
}
