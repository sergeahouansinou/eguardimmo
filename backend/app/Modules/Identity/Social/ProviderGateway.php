<?php

declare(strict_types=1);

namespace App\Modules\Identity\Social;

use App\Modules\Identity\Data\SocialProfileData;
use App\Modules\Identity\Enums\SocialProvider;
use Laravel\Socialite\Contracts\Provider;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\User as OAuthUser;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\RedirectResponse;

final readonly class ProviderGateway
{
    public function __construct(private AppleClientSecret $secretApple) {}

    public function redirect(SocialProvider $fournisseur, #[SensitiveParameter] string $state, string $nonce, bool $liaison): RedirectResponse
    {
        $parametres = ['state' => $state];
        $pilote = $this->pilote($fournisseur, $nonce);

        if ($fournisseur === SocialProvider::Apple && $liaison) {
            $parametres['response_mode'] = 'query';
            $pilote->setScopes([]);
        }

        return $pilote->with($parametres)->redirect();
    }

    /**
     * @return array{SocialProfileData, string|null}
     */
    public function user(SocialProvider $fournisseur, string $nonce): array
    {
        if ($fournisseur === SocialProvider::Apple) {
            config(['services.apple.client_secret' => $this->secretApple->generate((string) config('services.apple.client_id'))]);
            $usine = Socialite::getFacadeRoot();

            if (is_object($usine) && method_exists($usine, 'forgetDrivers')) {
                $usine->forgetDrivers();
            }
        }

        $utilisateur = $this->pilote($fournisseur, $nonce)->user();
        $brut = $utilisateur instanceof OAuthUser ? $utilisateur->getRaw() : [];

        return [
            new SocialProfileData(
                provider: $fournisseur,
                subject: (string) $utilisateur->getId(),
                email: $utilisateur->getEmail(),
                emailVerified: SocialProfileData::normalizeEmailVerified($brut['email_verified'] ?? null),
                name: $utilisateur->getName(),
            ),
            $fournisseur === SocialProvider::Apple ? $this->jetonDeRafraichissement($utilisateur) : null,
        ];
    }

    /**
     * @return Provider&AbstractProvider
     */
    private function pilote(SocialProvider $fournisseur, string $nonce): mixed
    {
        /** @var Provider&AbstractProvider $pilote */
        $pilote = Socialite::driver($fournisseur->value);
        $pilote->stateless();

        if ($fournisseur === SocialProvider::Apple && method_exists($pilote, 'setNonce')) {
            $pilote->setNonce($nonce);
        }

        return $pilote;
    }

    private function jetonDeRafraichissement(SocialiteUser $utilisateur): ?string
    {
        return $utilisateur instanceof OAuthUser && $utilisateur->refreshToken !== '' ? $utilisateur->refreshToken : null;
    }
}
