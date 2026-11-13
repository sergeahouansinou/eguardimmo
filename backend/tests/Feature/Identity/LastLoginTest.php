<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    Notification::fake();
    $this->freezeSecond();
});

it('enregistre la dernière connexion web sans toucher à updated_at', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr', 'updated_at' => now()->subDay()]);
    $avant = $user->updated_at?->toIso8601String();

    $this->postJson('/auth/login', ['email' => 'jean@exemple.fr', 'password' => 'password'])->assertOk();

    $user->refresh();
    expect($user->last_login_at?->toIso8601String())->toBe(now()->toIso8601String())
        ->and($user->updated_at?->toIso8601String())->toBe($avant);
});

it('n\'enregistre rien sur un échec ou avant la 2FA', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr']);

    $this->postJson('/auth/login', ['email' => 'jean@exemple.fr', 'password' => 'faux'])->assertUnprocessable();
    activerDeuxFacteurs($user);
    $this->postJson('/auth/login', ['email' => 'jean@exemple.fr', 'password' => 'password'])->assertJsonPath('two_factor', true);
    $this->postJson('/api/v1/auth/token', ['email' => 'jean@exemple.fr', 'password' => 'password', 'device_name' => 'iPhone'])->assertJsonPath('data.two_factor', true);

    expect($user->refresh()->last_login_at)->toBeNull();
});

it('enregistre la dernière connexion après le défi 2FA web', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr']);
    $secret = activerDeuxFacteurs($user);

    $this->postJson('/auth/login', ['email' => 'jean@exemple.fr', 'password' => 'password']);
    $this->postJson('/auth/two-factor-challenge', ['code' => codeTotp($secret)])->assertNoContent();

    expect($user->refresh()->last_login_at)->not->toBeNull();
});

it('enregistre la dernière connexion mobile', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr']);

    $this->postJson('/api/v1/auth/token', ['email' => 'jean@exemple.fr', 'password' => 'password', 'device_name' => 'iPhone'])->assertCreated();

    expect($user->refresh()->last_login_at?->toIso8601String())->toBe(now()->toIso8601String());
});

it('enregistre la dernière connexion console', function (): void {
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $user->operator()->create(['granted_at' => now()]);
    $secret = activerDeuxFacteurs($user);

    $this->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'code' => codeTotp($secret)])->assertCreated();

    expect($user->refresh()->last_login_at)->not->toBeNull();
});

it('conserve la connexion précédente à chaque nouvelle connexion', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr', 'last_login_at' => now()->subDays(3), 'previous_login_at' => now()->subWeek()]);
    $precedente = now()->subDays(3)->toIso8601String();

    $this->postJson('/api/v1/auth/token', ['email' => 'jean@exemple.fr', 'password' => 'password', 'device_name' => 'iPhone'])->assertCreated();

    $user->refresh();
    expect($user->previous_login_at?->toIso8601String())->toBe($precedente)
        ->and($user->last_login_at?->toIso8601String())->toBe(now()->toIso8601String());
});

it('laisse previous_login_at vide à la première connexion', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr']);

    $this->postJson('/api/v1/auth/token', ['email' => 'jean@exemple.fr', 'password' => 'password', 'device_name' => 'iPhone'])->assertCreated();

    expect($user->refresh()->previous_login_at)->toBeNull();
});

it('expose les deux dates dans /me', function (): void {
    $user = User::factory()->create(['last_login_at' => now()->subHour(), 'previous_login_at' => now()->subDay()]);

    $this->withToken($user->createToken('t', ['mobile'])->plainTextToken)
        ->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('data.last_login_at', now()->subHour()->toIso8601String())
        ->assertJsonPath('data.previous_login_at', now()->subDay()->toIso8601String());
});
