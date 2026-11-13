<?php

declare(strict_types=1);

namespace App\Modules\Identity\Social;

use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Enums\SocialIntentType;
use App\Modules\Identity\Enums\SocialProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Symfony\Component\HttpFoundation\Cookie;
use Throwable;

final readonly class OAuthState
{
    public const COOKIE_BINDER = '__Host-eg_oauth_binder';

    public const DUREE_SECONDES = 600;

    private function __construct(
        public SocialProvider $provider,
        public SocialIntentType $intent,
        public ?IntendedProfile $profile,
        public string $returnTo,
        public ?string $userId,
        public string $nonce,
        private string $binderHash,
        private int $expiresAt,
    ) {}

    /**
     * @return array{self, string, string}
     */
    public static function issue(SocialProvider $fournisseur, SocialIntentType $intention, ?IntendedProfile $profil, string $retour, ?string $userId): array
    {
        $binder = bin2hex(random_bytes(32));
        $etat = new self($fournisseur, $intention, $profil, $retour, $userId, bin2hex(random_bytes(16)), hash('sha256', $binder), now()->getTimestamp() + self::DUREE_SECONDES);

        Cache::put(self::cleNonce($etat->nonce), true, self::DUREE_SECONDES);

        $chiffre = Crypt::encryptString((string) json_encode([
            'pv' => $fournisseur->value,
            'i' => $intention->value,
            'p' => $profil?->value,
            'r' => $retour,
            'u' => $userId,
            'n' => $etat->nonce,
            'b' => $etat->binderHash,
            'e' => $etat->expiresAt,
        ], JSON_THROW_ON_ERROR));

        return [$etat, $chiffre, $binder];
    }

    public static function binderCookie(string $binder): Cookie
    {
        return Cookie::create(self::COOKIE_BINDER)
            ->withValue($binder)
            ->withExpires(now()->addSeconds(self::DUREE_SECONDES)->getTimestamp())
            ->withPath('/')
            ->withSecure(true)
            ->withHttpOnly(true)
            ->withSameSite(Cookie::SAMESITE_NONE);
    }

    public static function forgetBinderCookie(): Cookie
    {
        return self::binderCookie('')->withExpires(1);
    }

    /**
     * Déchiffre le state, vérifie le binder et consomme le nonce : null au moindre écart.
     */
    public static function consume(Request $request, SocialProvider $fournisseur): ?self
    {
        $etat = self::dechiffrer($request->input('state'));
        $binder = $request->cookies->get(self::COOKIE_BINDER);

        if ($etat === null || $etat->provider !== $fournisseur || $etat->expiresAt <= now()->getTimestamp()) {
            return null;
        }

        if (! is_string($binder) || $binder === '' || ! hash_equals($etat->binderHash, hash('sha256', $binder))) {
            return null;
        }

        $cle = self::cleNonce($etat->nonce);

        if (Cache::get($cle) !== true || ! Cache::add($cle.':consomme', true, self::DUREE_SECONDES)) {
            return null;
        }

        Cache::forget($cle);

        return $etat;
    }

    private static function dechiffrer(mixed $valeur): ?self
    {
        if (! is_string($valeur) || $valeur === '' || strlen($valeur) > 4096) {
            return null;
        }

        try {
            $d = json_decode(Crypt::decryptString($valeur), true, 4, JSON_THROW_ON_ERROR);

            if (! is_array($d) || ! is_string($d['pv'] ?? null) || ! is_string($d['i'] ?? null) || ! is_string($d['r'] ?? null)
                || ! is_string($d['n'] ?? null) || ! is_string($d['b'] ?? null) || ! is_int($d['e'] ?? null)) {
                return null;
            }

            $profil = is_string($d['p'] ?? null) ? IntendedProfile::from($d['p']) : null;
            $userId = is_string($d['u'] ?? null) ? $d['u'] : null;

            return new self(SocialProvider::from($d['pv']), SocialIntentType::from($d['i']), $profil, $d['r'], $userId, $d['n'], $d['b'], $d['e']);
        } catch (Throwable) {
            return null;
        }
    }

    private static function cleNonce(string $nonce): string
    {
        return 'identity:oauth-nonce:'.$nonce;
    }
}
