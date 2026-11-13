<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Data\SocialProfileData;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\SocialProvider;
use App\Shared\Http\ApiProblem;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use SensitiveParameter;
use stdClass;
use Throwable;

final class VerifyIdentityToken
{
    public const JWKS_GOOGLE = 'https://www.googleapis.com/oauth2/v3/certs';

    public const JWKS_APPLE = 'https://appleid.apple.com/auth/keys';

    private const ALGORITHME = 'RS256';

    private const TOLERANCE_SECONDES = 60;

    private const CACHE_JWKS_SECONDES = 3600;

    private const RECHARGEMENT_MIN_SECONDES = 60;

    private const SECOURS_JWKS_SECONDES = 86400;

    public function handle(SocialProvider $fournisseur, #[SensitiveParameter] string $idToken, #[SensitiveParameter] string $nonceBrut): SocialProfileData
    {
        $kid = $this->kid($idToken);
        $cles = $this->cles($fournisseur, false);

        if (! isset($cles[$kid]) && Cache::add('identity:jwks-refresh:'.$fournisseur->value, true, self::RECHARGEMENT_MIN_SECONDES)) {
            $cles = $this->cles($fournisseur, true);
        }

        if (! isset($cles[$kid])) {
            throw ErrorCode::InvalidIdToken->problem();
        }

        $revendications = $this->decoder($idToken, $cles);
        $this->verifierRevendications($fournisseur, $revendications, $nonceBrut);

        return new SocialProfileData(
            provider: $fournisseur,
            subject: (string) $revendications->sub,
            email: isset($revendications->email) && is_string($revendications->email) ? $revendications->email : null,
            emailVerified: SocialProfileData::normalizeEmailVerified($revendications->email_verified ?? null),
            name: isset($revendications->name) && is_string($revendications->name) ? $revendications->name : null,
        );
    }

    private function kid(string $idToken): string
    {
        $segments = explode('.', $idToken);

        if (count($segments) !== 3) {
            throw ErrorCode::InvalidIdToken->problem();
        }

        try {
            $entete = JWT::jsonDecode(JWT::urlsafeB64Decode($segments[0]));
        } catch (Throwable) {
            throw ErrorCode::InvalidIdToken->problem();
        }

        if (! $entete instanceof stdClass || ($entete->alg ?? null) !== self::ALGORITHME || ! is_string($entete->kid ?? null) || $entete->kid === '') {
            throw ErrorCode::InvalidIdToken->problem();
        }

        return $entete->kid;
    }

    /**
     * @return array<string, Key>
     */
    private function cles(SocialProvider $fournisseur, bool $forcer): array
    {
        $cleCache = 'identity:jwks:'.$fournisseur->value;
        $jwks = $forcer ? null : Cache::get($cleCache);

        if (! is_array($jwks)) {
            $jwks = $this->telechargerOuSecours($fournisseur, $forcer);
        }

        try {
            return JWK::parseKeySet($jwks, self::ALGORITHME);
        } catch (Throwable) {
            Cache::forget($cleCache);

            throw ErrorCode::ProviderUnavailable->problem();
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function telechargerOuSecours(SocialProvider $fournisseur, bool $forcer): array
    {
        $cleSecours = 'identity:jwks-secours:'.$fournisseur->value;

        try {
            $jwks = $this->telecharger($fournisseur);
        } catch (ApiProblem $e) {
            $secours = Cache::get($cleSecours);

            if ($forcer || ! is_array($secours)) {
                throw $e;
            }

            return $secours;
        }

        Cache::put('identity:jwks:'.$fournisseur->value, $jwks, self::CACHE_JWKS_SECONDES);
        Cache::put($cleSecours, $jwks, self::SECOURS_JWKS_SECONDES);

        return $jwks;
    }

    /**
     * @return array<string, mixed>
     */
    private function telecharger(SocialProvider $fournisseur): array
    {
        $url = $fournisseur === SocialProvider::Google ? self::JWKS_GOOGLE : self::JWKS_APPLE;

        try {
            $reponse = Http::timeout(3)->acceptJson()->get($url);
        } catch (ConnectionException) {
            throw ErrorCode::ProviderUnavailable->problem();
        }

        $jwks = $reponse->successful() ? $reponse->json() : null;

        if (! is_array($jwks) || ! is_array($jwks['keys'] ?? null) || $jwks['keys'] === []) {
            throw ErrorCode::ProviderUnavailable->problem();
        }

        try {
            JWK::parseKeySet($jwks, self::ALGORITHME);
        } catch (Throwable) {
            throw ErrorCode::ProviderUnavailable->problem();
        }

        return $jwks;
    }

    /**
     * @param  array<string, Key>  $cles
     */
    private function decoder(string $idToken, array $cles): stdClass
    {
        $tolerance = JWT::$leeway;
        $horloge = JWT::$timestamp;
        JWT::$leeway = self::TOLERANCE_SECONDES;
        JWT::$timestamp = now()->getTimestamp();

        try {
            return JWT::decode($idToken, $cles);
        } catch (Throwable $e) {
            throw ErrorCode::InvalidIdToken->problem();
        } finally {
            JWT::$leeway = $tolerance;
            JWT::$timestamp = $horloge;
        }
    }

    private function verifierRevendications(SocialProvider $fournisseur, stdClass $r, string $nonceBrut): void
    {
        if (! isset($r->exp) || ! is_numeric($r->exp) || ! is_string($r->sub ?? null) || $r->sub === '' || $nonceBrut === '') {
            throw ErrorCode::InvalidIdToken->problem();
        }

        $emetteurs = $fournisseur === SocialProvider::Google
            ? ['https://accounts.google.com', 'accounts.google.com']
            : ['https://appleid.apple.com'];

        if (! in_array($r->iss ?? null, $emetteurs, true)) {
            throw ErrorCode::InvalidIdToken->problem();
        }

        $audiences = $this->audiences($fournisseur);
        $aud = $r->aud ?? null;
        $audOk = is_string($aud) ? in_array($aud, $audiences, true) : (is_array($aud) && $aud !== [] && array_diff($aud, $audiences) === []);

        if (! $audOk) {
            throw ErrorCode::InvalidIdToken->problem();
        }

        if ($fournisseur === SocialProvider::Google && isset($r->azp) && ! in_array($r->azp, $audiences, true)) {
            throw ErrorCode::InvalidIdToken->problem();
        }

        $nonceAttendu = $fournisseur === SocialProvider::Apple ? hash('sha256', $nonceBrut) : $nonceBrut;

        if (! is_string($r->nonce ?? null) || ! hash_equals($nonceAttendu, $r->nonce)) {
            throw ErrorCode::InvalidIdToken->problem();
        }
    }

    /**
     * @return list<string>
     */
    private function audiences(SocialProvider $fournisseur): array
    {
        $valeur = $fournisseur === SocialProvider::Google
            ? config('services.google.mobile_client_ids')
            : [config('services.apple.bundle_id')];

        return is_array($valeur) ? array_values(array_filter($valeur, fn (mixed $v): bool => is_string($v) && $v !== '')) : [];
    }
}
