<?php

declare(strict_types=1);

namespace App\Modules\Identity\Listeners;

use App\Modules\Identity\Actions\RevokeUserCredentials;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\RecordAudit;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;

final readonly class SecureVerifiedEmail
{
    public function __construct(
        private RevokeUserCredentials $revoke,
        private RecordAudit $audit,
        private Request $request,
    ) {}

    public function handle(Verified $evenement): void
    {
        if (! $evenement->user instanceof User) {
            return;
        }

        $session = $this->request->hasSession() ? $this->request->session()->getId() : null;

        $this->revoke->handle($evenement->user, 'email_verified', $session);
        $this->audit->handle('auth.email.verified', $evenement->user->id);
    }
}
