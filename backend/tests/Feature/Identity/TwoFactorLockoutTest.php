<?php

declare(strict_types=1);

use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\AccountLockout;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    Notification::fake();
});

function verrouiller(string $email): void
{
    foreach (range(1, AccountLockout::ECHECS_MAX_PAR_HEURE) as $ignore) {
        app(AccountLockout::class)->recordFailure($email);
    }
}

it('verrouille la console après des codes TOTP faux répétés, malgré le bon mot de passe', function (): void {
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $user->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    $secret = activerDeuxFacteurs($user);

    foreach (range(1, AccountLockout::ECHECS_MAX_PAR_HEURE) as $essai) {
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.'.$essai])
            ->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'code' => '000000'])
            ->assertUnprocessable();
    }

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.1.1'])
        ->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'code' => codeTotp($secret)])
        ->assertTooManyRequests();

    expect(PersonalAccessToken::query()->count())->toBe(0);
});

it('cumule les échecs 2FA mobile d\'un défi à l\'autre', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr']);
    $secret = activerDeuxFacteurs($user);

    foreach (range(1, 2) as $tour) {
        $defi = $this->withServerVariables(['REMOTE_ADDR' => '10.1.0.'.$tour])
            ->postJson('/api/v1/auth/token', ['email' => 'jean@exemple.fr', 'password' => 'password', 'device_name' => 'iPhone'])
            ->json('data.challenge');

        foreach (range(1, 5) as $essai) {
            $this->withServerVariables(['REMOTE_ADDR' => '10.2.'.$tour.'.'.$essai])
                ->postJson('/api/v1/auth/token/two-factor', ['challenge' => $defi, 'code' => '000000'])
                ->assertUnprocessable();
        }
    }

    $this->withServerVariables(['REMOTE_ADDR' => '10.3.0.1'])
        ->postJson('/api/v1/auth/token', ['email' => 'jean@exemple.fr', 'password' => 'password', 'device_name' => 'iPhone'])
        ->assertTooManyRequests();
});

it('refuse le défi 2FA web d\'un compte verrouillé', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr']);
    $secret = activerDeuxFacteurs($user);
    $this->postJson('/auth/login', ['email' => 'jean@exemple.fr', 'password' => 'password'])->assertJsonPath('two_factor', true);

    verrouiller('jean@exemple.fr');

    $this->postJson('/auth/two-factor-challenge', ['code' => codeTotp($secret)])->assertTooManyRequests();
    $this->assertGuest('web');
});

it('compte les échecs du défi 2FA web dans le verrou du compte', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr']);
    activerDeuxFacteurs($user);
    $this->postJson('/auth/login', ['email' => 'jean@exemple.fr', 'password' => 'password']);

    $this->postJson('/auth/two-factor-challenge', ['code' => '000000'])->assertUnprocessable();

    expect(Cache::get('identity:lockout:echecs:'.hash('sha256', 'jean@exemple.fr')))->toBe(1);
});

it('ne remet le compteur à zéro qu\'après une connexion complète', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr']);
    $secret = activerDeuxFacteurs($user);
    $cle = 'identity:lockout:echecs:'.hash('sha256', 'jean@exemple.fr');

    $this->postJson('/auth/login', ['email' => 'jean@exemple.fr', 'password' => 'faux']);
    $this->postJson('/auth/login', ['email' => 'jean@exemple.fr', 'password' => 'password'])->assertJsonPath('two_factor', true);
    expect(Cache::get($cle))->toBe(1);

    $this->postJson('/auth/two-factor-challenge', ['code' => codeTotp($secret)])->assertNoContent();
    expect(Cache::get($cle))->toBeNull();
});

it('refuse de rejouer un code TOTP déjà utilisé', function (): void {
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $user->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    $code = codeTotp(activerDeuxFacteurs($user));

    $this->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'code' => $code])->assertCreated();
    $this->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'code' => $code])->assertUnprocessable();
});

it('ignore « se souvenir de moi » : aucun cookie recaller', function (): void {
    User::factory()->create(['email' => 'jean@exemple.fr']);

    $reponse = $this->postJson('/auth/login', ['email' => 'jean@exemple.fr', 'password' => 'password', 'remember' => true])->assertOk();

    expect(collect($reponse->headers->getCookies())->contains(fn ($c): bool => str_starts_with($c->getName(), 'remember_web_')))->toBeFalse();
});
