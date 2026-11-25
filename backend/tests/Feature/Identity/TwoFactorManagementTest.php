<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\TwoFactorChangedNotification;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Notification;
use Laravel\Fortify\Events\TwoFactorAuthenticationEnabled;
use Laravel\Fortify\Fortify;

beforeEach(function (): void {
    Notification::fake();
});

it('n\'expose aucun champ two_factor sur /me', function (): void {
    $user = User::factory()->create();
    activerDeuxFacteurs($user);

    $this->withToken($user->createToken('t', ['mobile'])->plainTextToken)
        ->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonMissingPath('data.two_factor_secret')
        ->assertJsonMissingPath('data.two_factor_recovery_codes')
        ->assertJsonMissingPath('data.two_factor_confirmed_at');
});

it('exige une confirmation de mot de passe pour activer la 2FA', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user, 'web')->postJson('/auth/user/two-factor-authentication')->assertStatus(423);

    expect($user->refresh()->two_factor_secret)->toBeNull();
});

it('active puis confirme la 2FA, révoque les jetons, audite et prévient', function (): void {
    $user = User::factory()->create();
    $jeton = $user->createToken('mobile', ['mobile'])->plainTextToken;

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => time()])
        ->postJson('/auth/user/two-factor-authentication')
        ->assertOk();

    $secret = Fortify::currentEncrypter()->decrypt((string) $user->refresh()->two_factor_secret);

    $this->postJson('/auth/user/confirmed-two-factor-authentication', ['code' => codeTotp($secret)])->assertOk();

    expect($user->refresh()->two_factor_confirmed_at)->not->toBeNull()
        ->and(AuditLog::query()->where('action', 'auth.two_factor.enabled')->count())->toBe(1);
    Notification::assertSentTo($user, TwoFactorChangedNotification::class, fn (TwoFactorChangedNotification $n): bool => $n->enabled);

    auth()->forgetGuards();
    $this->withToken($jeton)->getJson('/api/v1/me')->assertUnauthorized();
});

it('désactive la 2FA avec révocation et notification', function (): void {
    $user = User::factory()->create();
    activerDeuxFacteurs($user);

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => time(), EnsureRecentReauthentication::CLE_2FA => time()])
        ->deleteJson('/auth/user/two-factor-authentication')
        ->assertOk();

    expect($user->refresh()->two_factor_secret)->toBeNull()
        ->and(AuditLog::query()->where('action', 'auth.two_factor.disabled')->count())->toBe(1);
    Notification::assertSentTo($user, TwoFactorChangedNotification::class, fn (TwoFactorChangedNotification $n): bool => ! $n->enabled);
});

it('audite la régénération des codes de secours', function (): void {
    $user = User::factory()->create();
    activerDeuxFacteurs($user);

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => time(), EnsureRecentReauthentication::CLE_2FA => time()])
        ->postJson('/auth/user/two-factor-recovery-codes')
        ->assertOk();

    expect(AuditLog::query()->where('action', 'auth.two_factor.recovery_regenerated')->count())->toBe(1);
});

it('pose une ré-authentification récente par code TOTP', function (): void {
    $user = User::factory()->create();
    $secret = activerDeuxFacteurs($user);

    $this->actingAs($user, 'web')->postJson('/auth/reauthenticate/two-factor', ['code' => '000000'])->assertUnprocessable();
    expect(session(EnsureRecentReauthentication::CLE_2FA))->toBeNull();

    $this->actingAs($user, 'web')->postJson('/auth/reauthenticate/two-factor', ['code' => codeTotp($secret)])->assertNoContent();
    expect(session(EnsureRecentReauthentication::CLE_2FA))->toBeInt();
});

it('refuse la ré-authentification 2FA sans session', function (): void {
    $this->postJson('/auth/reauthenticate/two-factor', ['code' => '123456'])->assertUnauthorized();
});

dataset('routes de gestion du second facteur', [
    'secret' => ['getJson', '/auth/user/two-factor-secret-key'],
    'qr code' => ['getJson', '/auth/user/two-factor-qr-code'],
    'codes de secours' => ['getJson', '/auth/user/two-factor-recovery-codes'],
    'régénération' => ['postJson', '/auth/user/two-factor-recovery-codes'],
    'désactivation' => ['deleteJson', '/auth/user/two-factor-authentication'],
]);

it('refuse avec le seul mot de passe la gestion d\'une 2FA confirmée', function (string $methode, string $url): void {
    $user = User::factory()->create();
    $secret = activerDeuxFacteurs($user);
    $avant = $user->refresh()->two_factor_recovery_codes;

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => time()])
        ->{$methode}($url)
        ->assertForbidden()
        ->assertJsonPath('code', 'reauthentication_required');

    $user->refresh();
    expect($user->two_factor_confirmed_at)->not->toBeNull()
        ->and(Fortify::currentEncrypter()->decrypt((string) $user->two_factor_secret))->toBe($secret)
        ->and($user->two_factor_recovery_codes)->toBe($avant);
})->with('routes de gestion du second facteur');

it('refuse une preuve 2FA ancienne pour gérer une 2FA confirmée', function (string $methode, string $url): void {
    $user = User::factory()->create();
    activerDeuxFacteurs($user);

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => time(), EnsureRecentReauthentication::CLE_2FA => now()->subMinutes(11)->getTimestamp()])
        ->{$methode}($url)
        ->assertForbidden()
        ->assertJsonPath('code', 'reauthentication_required');
})->with('routes de gestion du second facteur');

it('laisse gérer une 2FA confirmée avec preuve 2FA récente et mot de passe confirmé', function (string $methode, string $url): void {
    $user = User::factory()->create();
    activerDeuxFacteurs($user);

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => time(), EnsureRecentReauthentication::CLE_2FA => time()])
        ->{$methode}($url)
        ->assertOk();
})->with('routes de gestion du second facteur');

it('exige toujours la confirmation du mot de passe en plus de la preuve 2FA', function (): void {
    $user = User::factory()->create();
    activerDeuxFacteurs($user);

    $this->actingAs($user, 'web')
        ->withSession([EnsureRecentReauthentication::CLE_2FA => time()])
        ->getJson('/auth/user/two-factor-secret-key')
        ->assertStatus(423);
});

it('refuse de remplacer le secret d\'une 2FA confirmée avec force, même avec une preuve 2FA', function (): void {
    $user = User::factory()->create();
    $secret = activerDeuxFacteurs($user);

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => time(), EnsureRecentReauthentication::CLE_2FA => time()])
        ->postJson('/auth/user/two-factor-authentication', ['force' => true])
        ->assertStatus(409)
        ->assertJsonPath('code', 'two_factor_already_enabled');

    expect(Fortify::currentEncrypter()->decrypt((string) $user->refresh()->two_factor_secret))->toBe($secret);
});

it('laisse lire le secret et le QR code pendant l\'activation initiale, avec le seul mot de passe', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user, 'web')->withSession(['auth.password_confirmed_at' => time()])->postJson('/auth/user/two-factor-authentication')->assertOk();
    $this->getJson('/auth/user/two-factor-secret-key')->assertOk()->assertJsonStructure(['secretKey']);
    $this->getJson('/auth/user/two-factor-qr-code')->assertOk()->assertJsonStructure(['svg', 'url']);
    $this->postJson('/auth/user/two-factor-authentication', ['force' => true])->assertOk();
});

it('lit les codes de secours juste après la confirmation, sans second code', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user, 'web')->withSession(['auth.password_confirmed_at' => time()])->postJson('/auth/user/two-factor-authentication')->assertOk();
    $secret = Fortify::currentEncrypter()->decrypt((string) $user->refresh()->two_factor_secret);
    $this->postJson('/auth/user/confirmed-two-factor-authentication', ['code' => codeTotp($secret)])->assertOk();

    $this->getJson('/auth/user/two-factor-recovery-codes')->assertOk()->assertJsonCount(8);
});

it('traite le remplacement du secret d\'une 2FA confirmée comme un changement de sécurité', function (): void {
    $user = User::factory()->create();
    activerDeuxFacteurs($user);
    $jeton = $user->createToken('mobile', ['mobile'])->plainTextToken;

    event(new TwoFactorAuthenticationEnabled($user));

    expect(AuditLog::query()->where('action', 'auth.two_factor.secret_replaced')->count())->toBe(1);
    Notification::assertSentTo($user, TwoFactorChangedNotification::class, fn (TwoFactorChangedNotification $n): bool => $n->replaced);
    auth()->forgetGuards();
    $this->withToken($jeton)->getJson('/api/v1/me')->assertUnauthorized();
});

it('ne déclenche ni alerte ni révocation à l\'activation initiale, la confirmation s\'en charge', function (): void {
    $user = User::factory()->create();
    $user->createToken('mobile', ['mobile']);

    $this->actingAs($user, 'web')->withSession(['auth.password_confirmed_at' => time()])->postJson('/auth/user/two-factor-authentication')->assertOk();

    Notification::assertNothingSent();
    expect($user->tokens()->count())->toBe(1);
});

it('ramène la fenêtre de confirmation du mot de passe à dix minutes par défaut', function (): void {
    expect(config('auth.password_timeout'))->toBe(600);
});

it('refuse de confirmer un code sur une 2FA déjà confirmée, même valide, et ne pose aucune preuve 2FA', function (): void {
    $user = User::factory()->create();
    $secret = activerDeuxFacteurs($user);
    $avant = $user->refresh()->two_factor_confirmed_at;

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => time()])
        ->postJson('/auth/user/confirmed-two-factor-authentication', ['code' => codeTotp($secret)])
        ->assertStatus(409)
        ->assertJsonPath('code', 'two_factor_already_enabled');

    expect(session(EnsureRecentReauthentication::CLE_2FA))->toBeNull()
        ->and($user->refresh()->two_factor_confirmed_at?->getTimestamp())->toBe($avant?->getTimestamp())
        ->and(AuditLog::query()->where('action', 'auth.two_factor.enabled')->count())->toBe(0);
    Notification::assertNothingSent();
});

it('refuse aussi la confirmation sur une 2FA confirmée avec une preuve 2FA récente', function (): void {
    $user = User::factory()->create();
    $secret = activerDeuxFacteurs($user);

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => time(), EnsureRecentReauthentication::CLE_2FA => time()])
        ->postJson('/auth/user/confirmed-two-factor-authentication', ['code' => codeTotp($secret)])
        ->assertStatus(409);
});
