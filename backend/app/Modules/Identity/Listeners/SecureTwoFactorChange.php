<?php

declare(strict_types=1);

namespace App\Modules\Identity\Listeners;

use App\Modules\Identity\Actions\RevokeUserCredentials;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\TwoFactorChangedNotification;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Request;
use Laravel\Fortify\Events\TwoFactorAuthenticationConfirmed;
use Laravel\Fortify\Events\TwoFactorAuthenticationDisabled;

final readonly class SecureTwoFactorChange
{
    public function __construct(
        private RevokeUserCredentials $revoke,
        private RecordAudit $audit,
        private Request $request,
    ) {}

    public function handle(TwoFactorAuthenticationConfirmed|TwoFactorAuthenticationDisabled $evenement): void
    {
        $user = data_get($evenement, 'user');

        if (! $user instanceof User) {
            return;
        }

        $active = $evenement instanceof TwoFactorAuthenticationConfirmed;
        $session = $this->request->hasSession() ? $this->request->session()->getId() : null;

        $this->revoke->handle($user, $active ? 'two_factor_enabled' : 'two_factor_disabled', $session);
        $this->audit->handle($active ? 'auth.two_factor.enabled' : 'auth.two_factor.disabled', $user->id);
        $user->notify(new TwoFactorChangedNotification($active));
    }
}
