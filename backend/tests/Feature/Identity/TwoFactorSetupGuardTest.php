<?php

declare(strict_types=1);

use App\Modules\Identity\Actions\StartMobileSession;
use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Laravel\Fortify\Events\TwoFactorAuthenticationConfirmed;
use Laravel\Fortify\Fortify;
use PragmaRX\Google2FA\Google2FA;

const ACTIVATION = '/auth/user/two-factor-authentication';
const CONFIRMATION = '/auth/user/confirmed-two-factor-authentication';

beforeEach(function (): void {
    Notification::fake();

    $this->compte = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $this->session = function (?User $charge = null, array $attributs = []): array {
        $this->flushSession();
        auth()->forgetGuards();
        $this->actingAs($charge ?? $this->compte->fresh(), 'web')
            ->withSession(['auth.password_confirmed_at' => time(), ...$attributs]);

        return $attributs;
    };

    $this->secretEnBase = function (): ?string {
        $chiffre = $this->compte->fresh()?->two_factor_secret;

        return $chiffre === null ? null : Fortify::currentEncrypter()->decrypt($chiffre);
    };

    $this->poser = function (?string $secret = null): string {
        $secret ??= app(Google2FA::class)->generateSecretKey();
        User::query()->findOrFail($this->compte->id)->forceFill([
            'two_factor_secret' => Fortify::currentEncrypter()->encrypt($secret),
            'two_factor_recovery_codes' => Fortify::currentEncrypter()->encrypt((string) json_encode(['code-du-tiers'])),
        ])->save();

        return $secret;
    };
});

it('remplace le secret créé par un tiers avant que le titulaire n\'active la 2FA', function (): void {
    ($this->session)();
    $this->postJson(ACTIVATION)->assertOk();
    $secretDuTiers = $this->getJson('/auth/user/two-factor-secret-key')->assertOk()->json('secretKey');
    $codesDuTiers = $this->getJson('/auth/user/two-factor-recovery-codes')->assertOk()->json();

    ($this->session)();
    $this->postJson(ACTIVATION)->assertOk();
    $secret = $this->getJson('/auth/user/two-factor-secret-key')->assertOk()->json('secretKey');

    expect($secret)->not->toBe($secretDuTiers)
        ->and($this->getJson('/auth/user/two-factor-recovery-codes')->json())->not->toContain(...$codesDuTiers);

    $this->postJson(CONFIRMATION, ['code' => codeTotp($secretDuTiers)])->assertUnprocessable();
    $this->postJson(CONFIRMATION, ['code' => codeTotp($secret)])->assertOk();

    expect($this->compte->fresh()?->hasConfirmedTwoFactor())->toBeTrue()
        ->and(($this->secretEnBase)())->toBe($secret);
});

it('refuse à une autre session l\'activation en cours', function (string $methode, string $adresse): void {
    ($this->session)();
    $this->postJson(ACTIVATION)->assertOk();
    $secret = ($this->secretEnBase)();
    $codes = $this->compte->fresh()?->recoveryCodes();

    ($this->session)();
    $this->json($methode, $adresse, ['code' => codeTotp((string) $secret)])
        ->assertConflict()
        ->assertJsonPath('code', 'two_factor_setup_expired')
        ->assertDontSee((string) $secret);

    expect($this->compte->fresh()?->two_factor_confirmed_at)->toBeNull()
        ->and(($this->secretEnBase)())->toBe($secret)
        ->and($this->compte->fresh()?->recoveryCodes())->toBe($codes);
})->with([
    'QR code' => ['GET', '/auth/user/two-factor-qr-code'],
    'clé' => ['GET', '/auth/user/two-factor-secret-key'],
    'codes de secours' => ['GET', '/auth/user/two-factor-recovery-codes'],
    'nouveaux codes de secours' => ['POST', '/auth/user/two-factor-recovery-codes'],
    'confirmation' => ['POST', CONFIRMATION],
]);

it('neutralise un secret en attente déjà en base', function (): void {
    $ancien = ($this->poser)();

    ($this->session)();
    $this->getJson('/auth/user/two-factor-secret-key')->assertConflict();
    $this->getJson('/auth/user/two-factor-qr-code')->assertConflict();
    $this->postJson(CONFIRMATION, ['code' => codeTotp($ancien)])->assertConflict();

    $this->postJson(ACTIVATION)->assertOk();

    expect(($this->secretEnBase)())->not->toBe($ancien)
        ->and($this->compte->fresh()?->recoveryCodes())->not->toContain('code-du-tiers');
    $this->postJson(CONFIRMATION, ['code' => codeTotp((string) ($this->secretEnBase)())])->assertOk();
});

it('refuse de confirmer sans activation préalable', function (): void {
    ($this->session)();

    $this->postJson(CONFIRMATION, ['code' => '123456'])->assertConflict()->assertJsonPath('code', 'two_factor_setup_expired');
});

it('ne confirme pas un secret remplacé pendant la confirmation', function (): void {
    ($this->session)();
    $this->postJson(ACTIVATION)->assertOk();
    $secret = (string) ($this->secretEnBase)();
    $chargeAvant = User::query()->findOrFail($this->compte->id);

    $secretDuTiers = ($this->poser)();
    auth()->forgetGuards();
    $this->actingAs($chargeAvant, 'web')->postJson(CONFIRMATION, ['code' => codeTotp($secret)])->assertConflict();

    expect($this->compte->fresh()?->two_factor_confirmed_at)->toBeNull()
        ->and(($this->secretEnBase)())->toBe($secretDuTiers);
});

it('ne laisse pas une requête chargée avant la confirmation toucher au second facteur', function (string $methode, string $adresse): void {
    ($this->session)();
    $this->postJson(ACTIVATION)->assertOk();
    $chargeAvant = User::query()->findOrFail($this->compte->id);
    $secret = (string) ($this->secretEnBase)();
    $this->postJson(CONFIRMATION, ['code' => codeTotp($secret)])->assertOk();
    $codes = $this->compte->fresh()?->recoveryCodes();

    ($this->session)($chargeAvant);
    $this->json($methode, $adresse)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    expect(($this->secretEnBase)())->toBe($secret)
        ->and($this->compte->fresh()?->hasConfirmedTwoFactor())->toBeTrue()
        ->and($this->compte->fresh()?->recoveryCodes())->toBe($codes);
})->with([
    'activation' => ['POST', ACTIVATION],
    'désactivation' => ['DELETE', ACTIVATION],
    'nouveaux codes de secours' => ['POST', '/auth/user/two-factor-recovery-codes'],
]);

it('conserve la même clé quand la même session reprend son activation', function (): void {
    ($this->session)();
    $this->postJson(ACTIVATION)->assertOk();
    $secret = (string) ($this->secretEnBase)();

    $this->postJson(ACTIVATION)->assertOk();
    $this->getJson('/auth/user/two-factor-secret-key')->assertOk()->assertJsonPath('secretKey', $secret);
    $this->getJson('/auth/user/two-factor-qr-code')->assertOk()->assertJsonStructure(['svg', 'url']);
    $this->postJson('/auth/user/two-factor-recovery-codes')->assertOk();
    $this->getJson('/auth/user/two-factor-recovery-codes')->assertOk()->assertJsonCount(8);
    $this->postJson(CONFIRMATION, ['code' => '000000'])->assertUnprocessable();
    $this->postJson(CONFIRMATION, ['code' => codeTotp($secret)])->assertOk();

    $this->getJson('/auth/user/two-factor-recovery-codes')->assertOk()->assertJsonCount(8);
    $this->postJson('/auth/user/two-factor-recovery-codes')->assertOk();
    $this->deleteJson(ACTIVATION)->assertOk();

    expect(($this->secretEnBase)())->toBeNull();
});

it('retrouve l\'activation en cours d\'une requête à l\'autre avec des sessions en base', function (): void {
    config(['session.driver' => 'database']);

    $requete = function (?string $navigateur, string $methode, string $adresse, array $corps = []) {
        app()->forgetInstance('session.store');
        app()->forgetInstance('auth.driver');
        app('session')->forgetDrivers();
        auth()->forgetGuards();
        $this->defaultCookies = $navigateur === null ? [] : [(string) config('session.cookie') => $navigateur];

        return $this->withCredentials()->json($methode, $adresse, $corps);
    };

    $connecter = function () use ($requete): string {
        $session = (string) $requete(null, 'POST', '/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'password'])
            ->assertOk()->getCookie((string) config('session.cookie'))?->getValue();

        return (string) $requete($session, 'POST', '/auth/user/confirm-password', ['password' => 'password'])
            ->assertCreated()->getCookie((string) config('session.cookie'))?->getValue();
    };

    $titulaire = $connecter();
    $autre = $connecter();
    expect($autre)->not->toBe($titulaire);

    $requete($titulaire, 'POST', ACTIVATION)->assertOk();
    $secret = (string) $requete($titulaire, 'GET', '/auth/user/two-factor-secret-key')->assertOk()->json('secretKey');

    $requete($autre, 'GET', '/auth/user/two-factor-secret-key')->assertConflict();
    $requete($titulaire, 'POST', CONFIRMATION, ['code' => codeTotp($secret)])->assertOk();
    $requete($titulaire, 'GET', '/auth/user/two-factor-recovery-codes')->assertOk()->assertJsonCount(8);
    $requete($autre, 'GET', '/auth/user/two-factor-secret-key')->assertUnauthorized();

    expect(DB::table((string) config('session.table'))->where('user_id', $this->compte->id)->count())->toBe(1);
});

it('n\'enregistre pas la confirmation quand une étape suivante échoue', function (): void {
    ($this->session)();
    $this->postJson(ACTIVATION)->assertOk();
    $secret = (string) ($this->secretEnBase)();
    $jeton = $this->compte->createToken('mobile', ['mobile']);
    Event::listen(TwoFactorAuthenticationConfirmed::class, fn () => throw new RuntimeException('panne'));

    $this->postJson(CONFIRMATION, ['code' => codeTotp($secret)])->assertServerError();

    expect($this->compte->fresh()?->two_factor_confirmed_at)->toBeNull()
        ->and(PersonalAccessToken::query()->whereKey($jeton->accessToken->id)->exists())->toBeTrue();
});

it('oublie l\'activation en cours à une nouvelle connexion dans la même session', function (): void {
    ($this->session)();
    $this->postJson(ACTIVATION)->assertOk();
    auth()->guard('web')->logout();
    auth()->forgetGuards();

    $this->postJson('/auth/login', ['email' => 'jeanne@exemple.fr', 'password' => 'password'])->assertOk();
    $this->postJson('/auth/user/confirm-password', ['password' => 'password'])->assertCreated();

    $this->getJson('/auth/user/two-factor-secret-key')->assertConflict();
});

it('permet d\'abandonner depuis une autre session une activation en cours, puis d\'en démarrer une', function (): void {
    ($this->session)();
    $this->postJson(ACTIVATION)->assertOk();

    ($this->session)();
    $this->deleteJson(ACTIVATION)->assertOk();
    expect(($this->secretEnBase)())->toBeNull();

    $this->postJson(ACTIVATION)->assertOk();
    $this->postJson(CONFIRMATION, ['code' => codeTotp((string) ($this->secretEnBase)())])->assertOk();
});

it('demande le second facteur quand la 2FA est confirmée pendant la vérification du mot de passe', function (string $adresse, array $corps, string $prefixe): void {
    Hash::partialMock()->shouldReceive('check')->once()->andReturnUsing(function (): bool {
        activerDeuxFacteurs(User::query()->findOrFail($this->compte->id));

        return true;
    });

    $this->postJson($adresse, ['email' => 'jeanne@exemple.fr', 'password' => 'password', ...$corps])
        ->assertSuccessful()
        ->assertJsonPath($prefixe.'two_factor', true)
        ->assertJsonMissingPath($prefixe.'token');

    $this->assertGuest('web');
    expect(PersonalAccessToken::query()->count())->toBe(0);
})->with([
    'connexion web' => ['/auth/login', [], ''],
    'jeton mobile' => ['/api/v1/auth/token', ['device_name' => 'iPhone'], 'data.'],
]);

it('ne délivre pas de jeton mobile à un compte chargé avant la confirmation', function (): void {
    $chargeAvant = User::query()->findOrFail($this->compte->id);
    activerDeuxFacteurs(User::query()->findOrFail($this->compte->id));

    $resultat = app(StartMobileSession::class)->handle($chargeAvant, 'iPhone');

    expect($resultat->token)->toBeNull()
        ->and($resultat->challenge)->not->toBeNull()
        ->and(PersonalAccessToken::query()->count())->toBe(0);
});
