<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Social\AppleClientSecret;
use Firebase\JWT\JWT;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use SensitiveParameter;
use stdClass;
use Throwable;

final readonly class ExchangeAppleAuthorizationCode
{
    public const URL = 'https://appleid.apple.com/auth/token';

    public function __construct(private AppleClientSecret $secret) {}

    public function handle(#[SensitiveParameter] string $code, string $sujetAttendu): ?string
    {
        $client = (string) config('services.apple.bundle_id');

        try {
            $reponse = Http::asForm()->timeout(5)->post(self::URL, [
                'client_id' => $client,
                'client_secret' => $this->secret->generate($client),
                'code' => $code,
                'grant_type' => 'authorization_code',
            ]);
        } catch (ConnectionException) {
            throw ErrorCode::ProviderUnavailable->problem();
        }

        if ($reponse->serverError()) {
            throw ErrorCode::ProviderUnavailable->problem();
        }

        $corps = $reponse->json();

        if (! $reponse->successful() || ! is_array($corps) || $this->sujet($corps['id_token'] ?? null) !== $sujetAttendu) {
            throw ErrorCode::InvalidIdToken->problem();
        }

        return is_string($corps['refresh_token'] ?? null) ? $corps['refresh_token'] : null;
    }

    private function sujet(mixed $idToken): ?string
    {
        if (! is_string($idToken) || substr_count($idToken, '.') !== 2) {
            return null;
        }

        try {
            $charge = JWT::jsonDecode(JWT::urlsafeB64Decode(explode('.', $idToken)[1]));
        } catch (Throwable) {
            return null;
        }

        return $charge instanceof stdClass && is_string($charge->sub ?? null) ? $charge->sub : null;
    }
}
