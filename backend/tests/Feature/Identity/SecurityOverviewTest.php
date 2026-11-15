<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Models\User;

const ORIGINE_SPA = ['Origin' => 'https://agence.eguardimmo.test', 'Referer' => 'https://agence.eguardimmo.test/'];

beforeEach(function (): void {
    config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
});

it('refuse l\'aperçu de sécurité sans authentification', function (): void {
    $this->getJson('/api/v1/me/security')->assertUnauthorized();
});

it('décrit un compte sans 2FA ni compte lié', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $this->actingAs($user, 'web')->getJson('/api/v1/me/security', ORIGINE_SPA)
        ->assertOk()
        ->assertExactJson(['data' => [
            'email' => 'jeanne@exemple.fr',
            'email_verified' => true,
            'has_password' => true,
            'two_factor' => ['enabled' => false, 'enabled_at' => null, 'backup_codes_remaining' => 0, 'backup_codes_total' => 0],
            'linked_accounts' => [
                ['provider' => 'google', 'linked' => false, 'email' => null, 'linked_at' => null],
                ['provider' => 'apple', 'linked' => false, 'email' => null, 'linked_at' => null],
            ],
            'devices' => [],
            'confirmed_until' => null,
            'confirmed_with_code_until' => null,
        ]]);
});

it('décrit la 2FA, les comptes liés et les appareils mobiles', function (): void {
    $user = User::factory()->unverified()->create(['password' => null]);
    activerDeuxFacteurs($user);
    $user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-1', 'email' => 'jeanne@gmail.test']);
    $jeton = $user->createToken('iPhone de Jeanne', ['mobile']);
    $user->createToken('jeton-console', ['console']);

    $reponse = $this->withToken($jeton->plainTextToken)->getJson('/api/v1/me/security')->assertOk();

    $reponse->assertJsonPath('data.has_password', false)
        ->assertJsonPath('data.email_verified', false)
        ->assertJsonPath('data.two_factor.enabled', true)
        ->assertJsonPath('data.two_factor.backup_codes_remaining', 2)
        ->assertJsonPath('data.two_factor.backup_codes_total', 8)
        ->assertJsonPath('data.linked_accounts.0.linked', true)
        ->assertJsonPath('data.linked_accounts.0.email', 'jeanne@gmail.test')
        ->assertJsonPath('data.linked_accounts.1.linked', false)
        ->assertJsonCount(1, 'data.devices')
        ->assertJsonPath('data.devices.0.name', 'iPhone de Jeanne')
        ->assertJsonPath('data.devices.0.type', 'mobile')
        ->assertJsonPath('data.devices.0.current', true)
        ->assertJsonPath('data.confirmed_until', null);

    expect($reponse->getContent())->not->toContain('two_factor_secret')->not->toContain('code-secours-1');
});

it('indique jusqu\'à quand la session est confirmée, par mot de passe puis par code', function (): void {
    $user = User::factory()->create();
    $maintenant = now()->getTimestamp();

    $this->withSession([EnsureRecentReauthentication::CLE_MOT_DE_PASSE => $maintenant])
        ->actingAs($user, 'web')
        ->getJson('/api/v1/me/security', ORIGINE_SPA)
        ->assertJsonPath('data.confirmed_until', now()->addMinutes(10)->toIso8601String())
        ->assertJsonPath('data.confirmed_with_code_until', null);

    $this->withSession([EnsureRecentReauthentication::CLE_2FA => $maintenant, EnsureRecentReauthentication::CLE_MOT_DE_PASSE => $maintenant - 120])
        ->actingAs($user, 'web')
        ->getJson('/api/v1/me/security', ORIGINE_SPA)
        ->assertJsonPath('data.confirmed_until', now()->addMinutes(10)->toIso8601String())
        ->assertJsonPath('data.confirmed_with_code_until', now()->addMinutes(10)->toIso8601String());
});

it('ignore une confirmation expirée', function (): void {
    $user = User::factory()->create();

    $this->withSession([EnsureRecentReauthentication::CLE_MOT_DE_PASSE => now()->subMinutes(11)->getTimestamp()])
        ->actingAs($user, 'web')
        ->getJson('/api/v1/me/security', ORIGINE_SPA)
        ->assertJsonPath('data.confirmed_until', null);
});

it('ne montre ni les appareils ni les comptes liés d\'un autre utilisateur', function (): void {
    $autre = User::factory()->create();
    $autre->createToken('appareil-voisin', ['mobile']);
    $autre->socialIdentities()->create(['provider' => SocialProvider::Apple, 'subject' => 'a-voisin', 'email' => 'voisin@exemple.fr']);
    $user = User::factory()->create();

    $this->actingAs($user, 'web')->getJson('/api/v1/me/security', ORIGINE_SPA)
        ->assertJsonCount(0, 'data.devices')
        ->assertJsonPath('data.linked_accounts.1.linked', false);
});
