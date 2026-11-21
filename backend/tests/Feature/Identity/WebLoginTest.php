<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\NewDeviceLoginNotification;
use App\Modules\Identity\Security\AbsoluteSession;
use App\Modules\Identity\Security\AccountLockout;
use App\Shared\Audit\AuditLog;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Notification;

beforeEach(function (): void {
    Notification::fake();
});

it('ouvre une session avec un e-mail et un mot de passe valides', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $this->postJson('/auth/login', ['email' => 'Jeanne@Exemple.fr', 'password' => 'password'])
        ->assertOk()
        ->assertExactJson(['two_factor' => false]);

    $this->assertAuthenticatedAs($user, 'web');
    expect(AuditLog::query()->where('action', 'auth.login.succeeded')->where('actor_user_id', $user->id)->exists())->toBeTrue()
        ->and(session(AbsoluteSession::CLE))->toBeInt();
});

it('répond pareil pour un mauvais mot de passe et un compte inconnu', function (): void {
    User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $mauvais = $this->postJson('/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'faux'])->assertUnprocessable();
    $inconnu = $this->postJson('/auth/login', ['email' => 'inconnu@exemple.fr', 'password' => 'faux'])->assertUnprocessable();

    expect(Arr::except($mauvais->json(), 'request_id'))->toBe(Arr::except($inconnu->json(), 'request_id'));
    $this->assertGuest('web');
});

it('refuse la connexion par mot de passe d\'un compte sans mot de passe', function (): void {
    User::factory()->create(['email' => 'social@exemple.fr', 'password' => null]);

    $this->postJson('/auth/login', ['email' => 'social@exemple.fr', 'password' => ''])->assertUnprocessable();
    $this->postJson('/auth/login', ['email' => 'social@exemple.fr', 'password' => 'nimportequoi'])->assertUnprocessable();
    $this->assertGuest('web');
});

it('journalise un échec avec l\'e-mail en HMAC, jamais en clair', function (): void {
    $this->postJson('/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'faux'])->assertUnprocessable();

    $entree = AuditLog::query()->where('action', 'auth.login.failed')->sole();

    expect($entree->metadata['email_hmac'])->toBe(hash_hmac('sha256', 'jeanne@exemple.fr', 'cle-hmac-de-test'))
        ->and(json_encode($entree->metadata))->not->toContain('jeanne');
});

it('bloque la 6e tentative en une minute', function (): void {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'faux'])->assertUnprocessable();
    }

    $this->postJson('/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'faux'])->assertTooManyRequests();
});

it('verrouille un compte après 10 échecs par heure, quelle que soit l\'IP', function (): void {
    User::factory()->create(['email' => 'jeanne@exemple.fr']);

    for ($i = 0; $i < AccountLockout::ECHECS_MAX_PAR_HEURE; $i++) {
        $this->withServerVariables(['REMOTE_ADDR' => "203.0.113.{$i}"])
            ->postJson('/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'faux'])
            ->assertUnprocessable();
    }

    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.7'])
        ->postJson('/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'password'])
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');

    $this->assertGuest('web');
});

it('allonge le verrouillage à chaque récidive', function (): void {
    $verrou = app(AccountLockout::class);

    for ($i = 0; $i < AccountLockout::ECHECS_MAX_PAR_HEURE; $i++) {
        $verrou->recordFailure('jeanne@exemple.fr');
    }

    $this->travel(16)->minutes();
    $verrou->ensureNotLocked('jeanne@exemple.fr');

    for ($i = 0; $i < AccountLockout::ECHECS_MAX_PAR_HEURE; $i++) {
        $verrou->recordFailure('jeanne@exemple.fr');
    }

    $this->travel(16)->minutes();

    expect(fn () => $verrou->ensureNotLocked('jeanne@exemple.fr'))->toThrow(ThrottleRequestsException::class);
});

it('demande le défi 2FA au lieu d\'ouvrir la session quand la 2FA est active', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);
    $secret = activerDeuxFacteurs($user);

    $this->postJson('/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'password'])
        ->assertOk()
        ->assertExactJson(['two_factor' => true]);
    $this->assertGuest('web');

    $this->postJson('/auth/two-factor-challenge', ['code' => '000000'])->assertUnprocessable();
    $this->assertGuest('web');

    $this->postJson('/auth/two-factor-challenge', ['code' => codeTotp($secret)])->assertNoContent();
    $this->assertAuthenticatedAs($user, 'web');
});

it('consomme un code de secours utilisé au défi 2FA web', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);
    activerDeuxFacteurs($user);

    $this->postJson('/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'password'])->assertJsonPath('two_factor', true);
    $this->postJson('/auth/two-factor-challenge', ['recovery_code' => 'code-secours-1'])->assertNoContent();

    expect($user->refresh()->recoveryCodes())->not->toContain('code-secours-1')
        ->and(AuditLog::query()->where('action', 'auth.two_factor.recovery_used')->count())->toBe(1);
});

it('limite le défi 2FA web à 5 essais par minute pour le compte en attente', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);
    activerDeuxFacteurs($user);
    $this->postJson('/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'password']);

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/auth/two-factor-challenge', ['code' => '000000'])->assertUnprocessable();
    }

    $this->postJson('/auth/two-factor-challenge', ['code' => '000000'])->assertTooManyRequests();
});

it('ferme la session au-delà de la durée absolue', function (): void {
    $user = User::factory()->create();
    $this->postJson('/auth/login', ['email' => $user->email, 'password' => 'password'])->assertOk();

    $this->withHeader('Referer', 'http://localhost:3000/')->getJson('/api/v1/me')->assertOk();
    $this->travel(721)->minutes();

    $this->withHeader('Referer', 'http://localhost:3000/')->getJson('/api/v1/me')->assertUnauthorized();
});

it('limite la session d\'un opérateur à 60 minutes', function (): void {
    $user = User::factory()->create();
    $user->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);
    $this->postJson('/auth/login', ['email' => $user->email, 'password' => 'password'])->assertOk();

    $this->withHeader('Referer', 'http://localhost:3000/')->getJson('/api/v1/me')->assertOk();
    $this->travel(61)->minutes();

    $this->withHeader('Referer', 'http://localhost:3000/')->getJson('/api/v1/me')->assertUnauthorized();
});

it('signale une connexion depuis un nouveau navigateur, pas depuis un navigateur connu', function (): void {
    $user = User::factory()->create();

    $this->withHeader('User-Agent', 'Navigateur A')->postJson('/auth/login', ['email' => $user->email, 'password' => 'password'])->assertOk();
    $this->postJson('/auth/logout')->assertNoContent();
    Notification::assertNothingSent();

    $this->withHeader('User-Agent', 'Navigateur A')->postJson('/auth/login', ['email' => $user->email, 'password' => 'password'])->assertOk();
    $this->postJson('/auth/logout');
    Notification::assertNothingSent();

    $this->withHeader('User-Agent', 'Navigateur B')->postJson('/auth/login', ['email' => $user->email, 'password' => 'password'])->assertOk();
    Notification::assertSentToTimes($user, NewDeviceLoginNotification::class, 1);
});
