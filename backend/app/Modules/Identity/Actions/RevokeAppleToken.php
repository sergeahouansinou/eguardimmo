<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Social\AppleClientSecret;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use SensitiveParameter;

final readonly class RevokeAppleToken
{
    public const URL = 'https://appleid.apple.com/auth/revoke';

    public function __construct(private AppleClientSecret $secret) {}

    /**
     * Apple répond invalid_grant pour un jeton déjà révoqué ou expiré : il n'y a plus rien à révoquer.
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
        } catch (ConnectionException) {
            throw ErrorCode::ProviderUnavailable->problem();
        }

        if ($reponse->successful() || $reponse->json('error') === 'invalid_grant') {
            return;
        }

        throw ErrorCode::ProviderUnavailable->problem();
    }
}
