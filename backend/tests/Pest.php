<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

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
