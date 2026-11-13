<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Data\MobileLoginResult;
use App\Modules\Identity\Data\SocialIntent;
use App\Modules\Identity\Data\SocialProfileData;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Models\User;
use App\Shared\Http\ApiProblem;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use SensitiveParameter;

final readonly class LoginWithIdentityToken
{
    public const ANTI_REJEU_SECONDES = 7200;

    public function __construct(
        private VerifyIdentityToken $verification,
        private ExchangeAppleAuthorizationCode $echangeApple,
        private ResolveSocialLogin $resolution,
        private StartMobileSession $session,
    ) {}

    public function handle(
        SocialProvider $fournisseur,
        #[SensitiveParameter] string $idToken,
        #[SensitiveParameter] string $nonce,
        #[SensitiveParameter] ?string $codeAutorisation,
        SocialIntent $intention,
        string $nomAppareil,
        ?string $nom,
    ): MobileLoginResult {
        $profil = $this->verification->handle($fournisseur, $idToken, $nonce);

        if ($profil->name === null && $nom !== null && trim($nom) !== '') {
            $profil = new SocialProfileData($profil->provider, $profil->subject, $profil->email, $profil->emailVerified, trim($nom));
        }

        $cleRejeu = self::cleAntiRejeu($idToken);

        if (! Cache::add($cleRejeu, true, self::ANTI_REJEU_SECONDES)) {
            throw ErrorCode::InvalidIdToken->problem();
        }

        try {
            $user = DB::transaction(fn (): User => $this->resoudre($profil, $intention, $codeAutorisation));
        } catch (ApiProblem $e) {
            // Le client rejoue le même id_token après un refus (no_account → register) ou une panne.
            if ($e->problemCode !== ErrorCode::InvalidIdToken->value) {
                Cache::forget($cleRejeu);
            }

            throw $e;
        }

        return $this->session->handle($user, $nomAppareil);
    }

    private function resoudre(SocialProfileData $profil, SocialIntent $intention, #[SensitiveParameter] ?string $codeAutorisation): User
    {
        $user = $this->resolution->handle($profil, $intention);

        if ($profil->provider === SocialProvider::Apple && $codeAutorisation !== null) {
            $jetonApple = $this->echangeApple->handle($codeAutorisation, $profil->subject);

            if ($jetonApple !== null) {
                $user->storeAppleRefreshToken($jetonApple, (string) config('services.apple.bundle_id'));
            }
        }

        return $user;
    }

    public static function cleAntiRejeu(#[SensitiveParameter] string $idToken): string
    {
        return 'identity:id-token:'.hash('sha256', $idToken);
    }
}
