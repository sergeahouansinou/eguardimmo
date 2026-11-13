<?php

declare(strict_types=1);

namespace App\Modules\Identity\Social;

use Firebase\JWT\JWT;
use RuntimeException;

final class AppleClientSecret
{
    private const AUDIENCE = 'https://appleid.apple.com';

    private const DUREE_SECONDES = 300;

    public function generate(string $sujet): string
    {
        $equipe = config('services.apple.team_id');
        $cle = config('services.apple.key_id');
        $chemin = config('services.apple.private_key_path');

        if (! is_string($equipe) || $equipe === '' || ! is_string($cle) || $cle === '' || ! is_string($chemin) || ! is_readable($chemin)) {
            throw new RuntimeException('Sign in with Apple n\'est pas configuré (APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY_PATH).');
        }

        $maintenant = now()->getTimestamp();

        return JWT::encode([
            'iss' => $equipe,
            'iat' => $maintenant,
            'exp' => $maintenant + self::DUREE_SECONDES,
            'aud' => self::AUDIENCE,
            'sub' => $sujet,
        ], (string) file_get_contents($chemin), 'ES256', $cle);
    }
}
