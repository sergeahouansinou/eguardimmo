<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

const NONCE_MOBILE = 'nonce-mobile-0123456789';
const AUD_GOOGLE = 'ios-client.apps.googleusercontent.com';

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

function activerDeuxFacteurs(User $user): string
{
    $secret = app(Google2FA::class)->generateSecretKey();

    $user->forceFill([
        'two_factor_secret' => Fortify::currentEncrypter()->encrypt($secret),
        'two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt((string) json_encode(['code-secours-1', 'code-secours-2'])),
        'two_factor_confirmed_at' => now(),
    ])->save();

    return $secret;
}

function codeTotp(string $secret): string
{
    return app(Google2FA::class)->getCurrentOtp($secret);
}

/**
 * @return array{keys: list<array<string, string>>}
 */
function jwks(OpenSSLAsymmetricKey $cle, string $kid = 'cle-1'): array
{
    $details = openssl_pkey_get_details($cle);
    $b64 = fn (string $v): string => rtrim(strtr(base64_encode($v), '+/', '-_'), '=');

    return ['keys' => [['kty' => 'RSA', 'kid' => $kid, 'use' => 'sig', 'alg' => 'RS256', 'n' => $b64($details['rsa']['n']), 'e' => $b64($details['rsa']['e'])]]];
}

/**
 * @param  array<string, mixed>  $surcharges
 */
function idTokenGoogle(OpenSSLAsymmetricKey $cle, array $surcharges = [], string $kid = 'cle-1'): string
{
    openssl_pkey_export($cle, $pem);

    return JWT::encode(array_merge([
        'iss' => 'https://accounts.google.com',
        'aud' => AUD_GOOGLE,
        'azp' => AUD_GOOGLE,
        'sub' => 'g-123',
        'email' => 'jean@exemple.fr',
        'email_verified' => true,
        'name' => 'Jean Dupont',
        'nonce' => NONCE_MOBILE,
        'iat' => now()->getTimestamp(),
        'exp' => now()->addHour()->getTimestamp(),
    ], $surcharges), $pem, 'RS256', $kid);
}

function idTokenApple(OpenSSLAsymmetricKey $cle, array $surcharges = []): string
{
    return idTokenGoogle($cle, array_merge([
        'iss' => 'https://appleid.apple.com',
        'aud' => 'fr.eguardimmo.app',
        'azp' => null,
        'sub' => 'a-001',
        'email_verified' => 'true',
        'name' => null,
        'nonce' => hash('sha256', NONCE_MOBILE),
    ], $surcharges));
}
