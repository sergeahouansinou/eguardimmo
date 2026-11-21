<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Push;

use Firebase\JWT\JWT;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Jeton OAuth2 d'un compte de service Google, signé RS256 depuis un fichier hors dépôt et mis en cache.
 */
final class FcmAccessToken
{
    private const string CLE_CACHE = 'notifications.fcm.access_token';

    private const string URL_JETON = 'https://oauth2.googleapis.com/token';

    private const string PORTEE = 'https://www.googleapis.com/auth/firebase.messaging';

    public function get(): ?string
    {
        $enCache = Cache::get(self::CLE_CACHE);

        if (is_string($enCache) && $enCache !== '') {
            return $enCache;
        }

        $compte = $this->account();

        if ($compte === null) {
            return null;
        }

        try {
            $maintenant = time();
            $assertion = JWT::encode([
                'iss' => $compte['client_email'],
                'scope' => self::PORTEE,
                'aud' => self::URL_JETON,
                'iat' => $maintenant,
                'exp' => $maintenant + 3600,
            ], $compte['private_key'], 'RS256');

            $reponse = Http::asForm()->timeout($this->timeout())->post(self::URL_JETON, [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $assertion,
            ]);
        } catch (ConnectionException) {
            Log::warning('Notifications push : jeton FCM indisponible (réseau)');

            return null;
        } catch (Throwable) {
            Log::warning('Notifications push : compte de service FCM inutilisable');

            return null;
        }

        $jeton = $reponse->json('access_token');

        if (! $reponse->successful() || ! is_string($jeton) || $jeton === '') {
            Log::warning('Notifications push : jeton FCM refusé', ['status' => $reponse->status()]);

            return null;
        }

        $duree = (int) $reponse->json('expires_in', 3600);
        Cache::put(self::CLE_CACHE, $jeton, max(60, $duree - 120));

        return $jeton;
    }

    public function forget(): void
    {
        Cache::forget(self::CLE_CACHE);
    }

    /**
     * @return array{client_email: string, private_key: string}|null
     */
    private function account(): ?array
    {
        $chemin = config('notifications.push.fcm.credentials');

        if (! is_string($chemin) || $chemin === '' || ! is_file($chemin) || ! is_readable($chemin)) {
            Log::warning('Notifications push : fichier de compte de service FCM introuvable');

            return null;
        }

        $donnees = json_decode((string) file_get_contents($chemin), true);

        if (! is_array($donnees) || ! is_string($donnees['client_email'] ?? null) || ! is_string($donnees['private_key'] ?? null)) {
            Log::warning('Notifications push : fichier de compte de service FCM invalide');

            return null;
        }

        return ['client_email' => $donnees['client_email'], 'private_key' => $donnees['private_key']];
    }

    private function timeout(): int
    {
        return max(1, (int) config('notifications.push.fcm.timeout', 5));
    }
}
