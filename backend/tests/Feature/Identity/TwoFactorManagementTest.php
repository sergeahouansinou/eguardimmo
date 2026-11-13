<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\TwoFactorChangedNotification;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Notification;
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
        ->withSession(['auth.password_confirmed_at' => time()])
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
        ->withSession(['auth.password_confirmed_at' => time()])
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
