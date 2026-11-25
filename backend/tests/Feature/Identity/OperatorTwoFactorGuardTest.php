<?php

declare(strict_types=1);

use App\Modules\Identity\Actions\EnrollTwoFactorOnServer;
use App\Modules\Identity\Actions\GrantOperator;
use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\TwoFactorChangedNotification;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Fortify;
use Laravel\Fortify\Http\Requests\TwoFactorLoginRequest;
use PragmaRX\Google2FA\Google2FA;

const CONFIRMATION_ENROLEMENT = 'Remplacer la double authentification de ops@exemple.fr et fermer ses sessions ? Le titulaire doit être présent.';
const QUESTION_CODE_ENROLEMENT = 'Code à 6 chiffres affiché par l\'application du titulaire';

beforeEach(function (): void {
    Notification::fake();

    $this->operateur = function (bool $deuxFacteurs = false): User {
        $user = User::factory()->create(['email' => 'ops@exemple.fr']);
        $user->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);

        if ($deuxFacteurs) {
            activerDeuxFacteurs($user);
        }

        return $user;
    };

    $this->jetonConsole = fn (string $code) => $this->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'code' => $code]);
});

it('ne laisse pas le seul mot de passe activer la 2FA d\'un opérateur ni ouvrir la console', function (): void {
    $user = ($this->operateur)();

    $this->postJson('/auth/login', ['email' => 'ops@exemple.fr', 'password' => 'password'])->assertOk();
    $this->postJson('/auth/user/confirm-password', ['password' => 'password'])->assertCreated();

    $this->postJson('/auth/user/two-factor-authentication')
        ->assertForbidden()
        ->assertJsonPath('code', 'operator_two_factor_server_only');

    expect($user->refresh()->two_factor_secret)->toBeNull();

    ($this->jetonConsole)('123456')->assertUnprocessable();

    expect(PersonalAccessToken::query()->count())->toBe(0);
});

const ROUTES_DU_SECOND_FACTEUR = [
    'activation' => ['POST', '/auth/user/two-factor-authentication'],
    'confirmation' => ['POST', '/auth/user/confirmed-two-factor-authentication'],
    'désactivation' => ['DELETE', '/auth/user/two-factor-authentication'],
    'qr code' => ['GET', '/auth/user/two-factor-qr-code'],
    'clé secrète' => ['GET', '/auth/user/two-factor-secret-key'],
    'codes de secours' => ['GET', '/auth/user/two-factor-recovery-codes'],
    'nouveaux codes de secours' => ['POST', '/auth/user/two-factor-recovery-codes'],
];

it('refuse à un opérateur sans 2FA confirmée toute route de gestion du second facteur', function (string $methode, string $url): void {
    $user = ($this->operateur)();
    $secret = app(Google2FA::class)->generateSecretKey();
    $user->forceFill([
        'two_factor_secret' => Fortify::currentEncrypter()->encrypt($secret),
        'two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt((string) json_encode(['code-secours-1'])),
    ])->save();

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => time()])
        ->json($methode, $url, ['code' => codeTotp($secret)])
        ->assertForbidden()
        ->assertJsonPath('code', 'operator_two_factor_server_only');

    expect($user->refresh()->two_factor_confirmed_at)->toBeNull()
        ->and($user->two_factor_secret)->not->toBeNull();
})->with(ROUTES_DU_SECOND_FACTEUR);

it('refuse à un opérateur à 2FA confirmée toute route de gestion du second facteur, même avec une preuve récente', function (string $methode, string $url): void {
    $user = ($this->operateur)(deuxFacteurs: true);
    $avant = [$user->two_factor_secret, $user->two_factor_recovery_codes];

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => time(), EnsureRecentReauthentication::CLE_2FA => time()])
        ->json($methode, $url, ['code' => '123456'])
        ->assertForbidden()
        ->assertJsonPath('code', 'operator_two_factor_server_only')
        ->assertJsonMissingPath('secretKey');

    $user->refresh();
    expect([$user->two_factor_secret, $user->two_factor_recovery_codes])->toBe($avant)
        ->and($user->hasConfirmedTwoFactor())->toBeTrue();
})->with(ROUTES_DU_SECOND_FACTEUR);

it('rend à un opérateur révoqué l\'activation et la désactivation ordinaires', function (): void {
    $user = ($this->operateur)();
    $user->operator()->update(['revoked_at' => now()]);

    $this->actingAs($user->refresh(), 'web')
        ->withSession(['auth.password_confirmed_at' => time()])
        ->postJson('/auth/user/two-factor-authentication')
        ->assertOk();

    $this->deleteJson('/auth/user/two-factor-authentication')->assertOk();

    expect($user->refresh()->two_factor_secret)->toBeNull();
});

it('enrôle depuis le serveur un opérateur sans 2FA, ferme ses sessions et lui ouvre la console', function (): void {
    $user = ($this->operateur)();
    $user->createToken('mobile', ['mobile']);
    DB::table('sessions')->insert(['id' => 'sess-ops', 'user_id' => $user->id, 'payload' => '', 'last_activity' => time()]);
    $secret = imposerSecretTotp();

    $this->artisan('identity:enroll-operator-two-factor', ['email' => 'Ops@Exemple.fr'])
        ->expectsConfirmation(CONFIRMATION_ENROLEMENT, 'yes')
        ->expectsOutputToContain($secret)
        ->expectsQuestion(QUESTION_CODE_ENROLEMENT, codeTotp($secret))
        ->assertSuccessful();

    $user->refresh();
    expect($user->hasConfirmedTwoFactor())->toBeTrue()
        ->and(Fortify::currentEncrypter()->decrypt((string) $user->two_factor_secret))->toBe($secret)
        ->and($user->recoveryCodes())->toHaveCount(8)
        ->and($user->tokens()->count())->toBe(0)
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'auth.two_factor.enrolled_on_server')->where('subject_id', $user->id)->first()?->metadata)
        ->toMatchArray(['via' => 'artisan', 'host' => (string) gethostname()]);
    Notification::assertSentTo($user, TwoFactorChangedNotification::class);

    Cache::flush();
    ($this->jetonConsole)(codeTotp($secret))->assertCreated();
});

it('remplace depuis le serveur un second facteur détenu par un tiers', function (): void {
    $user = ($this->operateur)(deuxFacteurs: true);
    $ancien = (string) $user->two_factor_secret;
    $secretDuTiers = Fortify::currentEncrypter()->decrypt($ancien);
    $user->createToken('console', ['operator']);
    $secret = imposerSecretTotp();

    $this->artisan('identity:enroll-operator-two-factor', ['email' => 'ops@exemple.fr'])
        ->expectsConfirmation(CONFIRMATION_ENROLEMENT, 'yes')
        ->expectsQuestion(QUESTION_CODE_ENROLEMENT, codeTotp($secret))
        ->assertSuccessful();

    Cache::flush();
    expect($user->refresh()->tokens()->count())->toBe(0)
        ->and($user->recoveryCodes())->not->toContain('code-secours-1');
    ($this->jetonConsole)(codeTotp($secretDuTiers))->assertUnprocessable();
    Notification::assertSentTo($user, TwoFactorChangedNotification::class, fn (TwoFactorChangedNotification $n): bool => $n->replaced);
});

it('n\'écrit rien quand le code d\'enrôlement est faux', function (): void {
    $user = ($this->operateur)();
    $user->createToken('mobile', ['mobile']);
    imposerSecretTotp();

    $this->artisan('identity:enroll-operator-two-factor', ['email' => 'ops@exemple.fr'])
        ->expectsConfirmation(CONFIRMATION_ENROLEMENT, 'yes')
        ->expectsQuestion(QUESTION_CODE_ENROLEMENT, '000000x')
        ->assertFailed();

    expect($user->refresh()->two_factor_secret)->toBeNull()
        ->and($user->tokens()->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'auth.two_factor.enrolled_on_server')->count())->toBe(0);
    Notification::assertNothingSent();
});

it('n\'enrôle rien sans confirmation', function (): void {
    $user = ($this->operateur)();

    $this->artisan('identity:enroll-operator-two-factor', ['email' => 'ops@exemple.fr'])
        ->expectsConfirmation(CONFIRMATION_ENROLEMENT, 'no')
        ->assertFailed();

    expect($user->refresh()->two_factor_secret)->toBeNull();
});

it('échoue à enrôler un e-mail inconnu', function (): void {
    $this->artisan('identity:enroll-operator-two-factor', ['email' => 'inconnu@exemple.fr'])->assertFailed();

    expect(AuditLog::query()->count())->toBe(0);
});

it('écarte à l\'attribution un second facteur confirmé connu d\'un tiers', function (): void {
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $secretDuTiers = activerDeuxFacteurs($user);
    $secret = imposerSecretTotp();

    $this->artisan('identity:grant-operator', ['email' => 'ops@exemple.fr', '--role' => ['admin']])
        ->expectsConfirmation('Attribuer le rôle opérateur (admin) à ops@exemple.fr ?', 'yes')
        ->expectsOutputToContain($secret)
        ->expectsQuestion(QUESTION_CODE_ENROLEMENT, codeTotp($secret))
        ->assertSuccessful();

    Cache::flush();
    ($this->jetonConsole)(codeTotp($secretDuTiers))->assertUnprocessable();
    $this->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'recovery_code' => 'code-secours-1'])->assertUnprocessable();
    ($this->jetonConsole)(codeTotp($secret))->assertCreated();
});

it('réserve l\'enrôlement serveur aux opérateurs actifs', function (): void {
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);

    $this->artisan('identity:enroll-operator-two-factor', ['email' => 'ops@exemple.fr'])
        ->expectsOutputToContain('identity:grant-operator')
        ->assertFailed();

    expect($user->refresh()->two_factor_secret)->toBeNull();
});

it('ne délivre pas de jeton console sur un second facteur remplacé pendant la vérification du mot de passe', function (): void {
    $user = User::factory()->create(['email' => 'ops@exemple.fr']);
    $secretDuTiers = activerDeuxFacteurs($user);
    $secret = app(Google2FA::class)->generateSecretKey();

    Hash::partialMock()->shouldReceive('check')->once()->andReturnUsing(function () use ($user, $secret): bool {
        app(GrantOperator::class)->handle($user->fresh() ?? $user, [OperatorRole::Admin], $secret, codeTotp($secret));

        return true;
    });

    ($this->jetonConsole)(codeTotp($secretDuTiers))->assertUnprocessable();

    expect($user->fresh()?->isActiveOperator())->toBeTrue()
        ->and(PersonalAccessToken::query()->count())->toBe(0);
});

it('ne rétablit pas les anciens codes de secours quand le second facteur est remplacé pendant leur consommation', function (): void {
    $user = ($this->operateur)(deuxFacteurs: true);
    $chargeAvant = User::query()->findOrFail($user->id);
    $secret = app(Google2FA::class)->generateSecretKey();
    app(EnrollTwoFactorOnServer::class)->handle($user, $secret, codeTotp($secret));
    $neufs = $user->fresh()?->recoveryCodes();

    expect(fn () => $chargeAvant->replaceRecoveryCode('code-secours-1'))->toThrow(ValidationException::class);
    expect($user->fresh()?->recoveryCodes())->toBe($neufs);
    $this->postJson('/api/v1/console/auth/token', ['email' => 'ops@exemple.fr', 'password' => 'password', 'recovery_code' => 'code-secours-2'])->assertUnprocessable();
});

it('n\'ouvre pas de session web avec un code de secours retiré pendant le défi', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);
    activerDeuxFacteurs($user);
    $this->postJson('/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'password'])->assertJsonPath('two_factor', true);

    $retire = false;
    User::retrieved(function (User $charge) use (&$retire): void {
        $chargeParLeDefi = collect(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 40))->contains('class', TwoFactorLoginRequest::class);

        if (! $retire && $chargeParLeDefi) {
            $retire = true;
            User::query()->findOrFail($charge->id)->replaceRecoveryCode('code-secours-1');
        }
    });

    $this->postJson('/auth/two-factor-challenge', ['recovery_code' => 'code-secours-1'])->assertUnprocessable();

    expect($retire)->toBeTrue();
    $this->assertGuest('web');
});

it('consomme un code de secours à l\'émission d\'un jeton console, une seule fois', function (): void {
    ($this->operateur)(deuxFacteurs: true);
    $corps = ['email' => 'ops@exemple.fr', 'password' => 'password', 'recovery_code' => 'code-secours-1'];

    $this->postJson('/api/v1/console/auth/token', $corps)->assertCreated();
    $this->postJson('/api/v1/console/auth/token', $corps)->assertUnprocessable();
});
