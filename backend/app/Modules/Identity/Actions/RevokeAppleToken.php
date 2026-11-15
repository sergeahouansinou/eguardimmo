<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Social\AppleClientSecret;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use SensitiveParameter;

final readonly class RevokeAppleToken
{
    public const URL = 'https://appleid.apple.com/auth/revoke';

    public function __construct(private AppleClientSecret $secret) {}

    /**
     * Apple répond invalid_grant pour un jeton déjà révoqué ou expiré : il n'y a plus rien à révoquer.
     *
     * @throws RuntimeException révocation non confirmée (réseau, configuration, refus d'Apple)
     */
    public function handle(#[SensitiveParameter] string $refreshToken, string $clientId): void
    {
        try {
            $reponse = Http::asForm()->timeout(5)->post(self::URL, [
                'client_id' => $clientId,
                'client_secret' => $this->secret->generate($clientId),
                'token' => $refreshToken,
                'token_type_hint' => 'refresh_token',
            ]);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Révocation Apple : service injoignable.', previous: $e);
        }

        $erreur = $reponse->json('error');

        if ($reponse->successful() || $erreur === 'invalid_grant') {
            return;
        }

        throw new RuntimeException(sprintf('Révocation Apple refusée : HTTP %d (%s).', $reponse->status(), is_string($erreur) ? $erreur : 'sans code'));
    }
}
