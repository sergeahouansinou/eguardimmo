<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Data\ReauthenticationData;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\Cache;

final readonly class ConfirmAccountOwnership
{
    public function __construct(
        private VerifyTwoFactorCode $deuxFacteurs,
        private VerifyIdentityToken $jetonIdentite,
        private CheckAccountPassword $motDePasse,
    ) {}

    /**
     * Preuves acceptées : code 2FA (ou confirmation 2FA récente de la session), mot de passe (ou confirmation récente)
     * pour un compte sans 2FA, id_token d'un fournisseur lié. Avec la 2FA active, le mot de passe seul ne suffit jamais.
     */
    public function handle(User $user, ReauthenticationData $preuve): void
    {
        if ($preuve->recentTwoFactorConfirmation || $this->parDeuxFacteurs($user, $preuve) || $this->parMotDePasse($user, $preuve) || $this->parFournisseur($user, $preuve)) {
            return;
        }

        throw ErrorCode::ReauthenticationRequired->problem();
    }

    private function parDeuxFacteurs(User $user, ReauthenticationData $preuve): bool
    {
        if (! $user->hasConfirmedTwoFactor() || ($preuve->code === null && $preuve->recoveryCode === null)) {
            return false;
        }

        return $this->deuxFacteurs->handle($user, $preuve->code, $preuve->recoveryCode);
    }

    private function parMotDePasse(User $user, ReauthenticationData $preuve): bool
    {
        if ($user->hasConfirmedTwoFactor()) {
            return false;
        }

        return $preuve->recentPasswordConfirmation || $this->motDePasse->handle($user, $preuve->password, 'account_deletion');
    }

    private function parFournisseur(User $user, ReauthenticationData $preuve): bool
    {
        if ($preuve->provider === null || $preuve->idToken === null || $preuve->nonce === null) {
            return false;
        }

        $profil = $this->jetonIdentite->handle($preuve->provider, $preuve->idToken, $preuve->nonce);

        $lie = $user->socialIdentities()
            ->where('provider', $profil->provider->value)
            ->where('subject', $profil->subject)
            ->exists();

        return $lie && Cache::add(LoginWithIdentityToken::cleAntiRejeu($preuve->idToken), true, LoginWithIdentityToken::ANTI_REJEU_SECONDES);
    }
}
