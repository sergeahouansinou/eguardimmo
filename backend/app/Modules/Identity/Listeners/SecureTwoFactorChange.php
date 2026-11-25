<?php

declare(strict_types=1);

namespace App\Modules\Identity\Listeners;

use App\Modules\Identity\Actions\RevokeUserCredentials;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\TwoFactorChangedNotification;
use App\Modules\Identity\Security\PendingTwoFactorSetup;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Request;
use Laravel\Fortify\Events\TwoFactorAuthenticationConfirmed;
use Laravel\Fortify\Events\TwoFactorAuthenticationDisabled;
use Laravel\Fortify\Events\TwoFactorAuthenticationEnabled;

final readonly class SecureTwoFactorChange
{
    public function __construct(
        private RevokeUserCredentials $revoke,
        private RecordAudit $audit,
        private Request $request,
        private PendingTwoFactorSetup $activation,
    ) {}

    public function handle(TwoFactorAuthenticationConfirmed|TwoFactorAuthenticationDisabled|TwoFactorAuthenticationEnabled $evenement): void
    {
        $user = data_get($evenement, 'user');

        if (! $user instanceof User) {
            return;
        }

        $remplace = $evenement instanceof TwoFactorAuthenticationEnabled;

        if ($remplace && ! $user->hasConfirmedTwoFactor()) {
            if ($this->request->hasSession()) {
                $this->activation->remember($this->request->session(), $user);
            }

            return;
        }

        $active = $evenement instanceof TwoFactorAuthenticationConfirmed;
        $session = $this->request->hasSession() ? $this->request->session()->getId() : null;

        $this->revoke->handle($user, $remplace ? 'two_factor_secret_replaced' : ($active ? 'two_factor_enabled' : 'two_factor_disabled'), $session);
        $this->audit->handle($remplace ? 'auth.two_factor.secret_replaced' : ($active ? 'auth.two_factor.enabled' : 'auth.two_factor.disabled'), $user->id);

        if ($active && $this->request->hasSession()) {
            $this->request->session()->put(EnsureRecentReauthentication::CLE_2FA, now()->getTimestamp());
            $this->request->session()->put(EnsureRecentReauthentication::CLE_METHODE_2FA, EnsureRecentReauthentication::METHODE_TOTP);
        }

        $user->notify(new TwoFactorChangedNotification($active || $remplace, $remplace));
    }
}
