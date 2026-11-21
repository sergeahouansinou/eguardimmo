<?php

declare(strict_types=1);

use App\Modules\Identity\Actions\DeleteAccount;
use App\Modules\Identity\Actions\RevokeAppleToken;
use App\Modules\Identity\Actions\VerifyIdentityToken;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\SocialIdentity;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\AccountLockout;
use App\Providers\HttpSecurityServiceProvider;
use App\Shared\Audit\AuditLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as RequeteHttp;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

const MDP_COMPTE = 'Mot-de-passe-solide-2026!';

beforeEach(function (): void {
    Notification::fake();
    Http::preventStrayRequests();

    $this->user = User::factory()->create(['email' => 'jean@exemple.fr', 'password' => MDP_COMPTE]);
    $this->jeton = $this->user->createToken('iphone', ['mobile'])->plainTextToken;
});

function supprimer(mixed $test, array $corps = []): mixed
{
    return $test->withToken($test->jeton)->deleteJson('/api/v1/me', $corps);
}

function configurerApple(mixed $test): void
{
    $cleEc = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
    openssl_pkey_export($cleEc, $pem);
    $test->cheminCle = (string) tempnam(sys_get_temp_dir(), 'apple-p8-');
    file_put_contents($test->cheminCle, $pem);

    config([
        'services.apple.team_id' => 'EQUIPE1234',
        'services.apple.key_id' => 'CLE1234567',
        'services.apple.private_key_path' => $test->cheminCle,
        'services.apple.bundle_id' => 'fr.eguardimmo.app',
    ]);
}

afterEach(function (): void {
    if (isset($this->cheminCle)) {
        @unlink($this->cheminCle);
    }
});

it('refuse la suppression sans authentification', function (): void {
    $this->deleteJson('/api/v1/me', ['password' => MDP_COMPTE])->assertUnauthorized();

    expect(User::query()->whereKey($this->user->id)->exists())->toBeTrue();
});

it('exige une ré-authentification', function (array $corps): void {
    supprimer($this, $corps)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');

    expect($this->user->fresh()?->deleted_at)->toBeNull();
})->with([
    'sans preuve' => [[]],
    'mauvais mot de passe' => [['password' => 'faux-mot-de-passe']],
]);

it('marque le compte supprimé sans l\'effacer et libère l\'e-mail', function (): void {
    Event::fake([AccountDeleted::class]);
    $this->user->createToken('autre', ['mobile']);
    DB::table('password_reset_tokens')->insert(['email' => 'jean@exemple.fr', 'token' => 'x', 'created_at' => now()]);

    supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();

    $ligne = DB::table('users')->where('id', $this->user->id)->first();
    expect($ligne)->not->toBeNull()
        ->and($ligne->deleted_at)->not->toBeNull()
        ->and($ligne->email)->toBe('jean@exemple.fr-deleted-'.$this->user->id)
        ->and($ligne->name)->toBe($this->user->name)
        ->and(PersonalAccessToken::query()->where('tokenable_id', $this->user->id)->count())->toBe(0)
        ->and(DB::table('password_reset_tokens')->where('email', 'jean@exemple.fr')->exists())->toBeFalse()
        ->and(User::query()->whereKey($this->user->id)->exists())->toBeFalse();

    Event::assertDispatched(AccountDeleted::class, fn (AccountDeleted $e): bool => $e->userId === $this->user->id);
    expect(AuditLog::query()->forSubject('user', $this->user->id)->pluck('action')->all())->toContain('user.deleted');
});

it('n\'accepte plus l\'ancien jeton après suppression', function (): void {
    supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();
    auth()->forgetGuards();

    $this->withToken($this->jeton)->getJson('/api/v1/me')->assertUnauthorized();
});

it('permet de se réinscrire avec la même adresse', function (): void {
    supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();
    auth()->forgetGuards();

    $this->postJson('/auth/register', [
        'name' => 'Jean Nouveau', 'email' => 'jean@exemple.fr', 'password' => 'Autre-mot-de-passe-2026!',
        'password_confirmation' => 'Autre-mot-de-passe-2026!', 'intended_profile' => 'agency',
    ])->assertStatus(202);

    expect(User::query()->where('email', 'jean@exemple.fr')->sole()->id)->not->toBe($this->user->id);
});

it('refuse l\'inscription d\'une adresse portant le marqueur de suppression', function (): void {
    $this->postJson('/auth/register', [
        'name' => 'Pirate', 'email' => 'jean@exemple.fr-deleted-'.$this->user->id, 'password' => 'Autre-mot-de-passe-2026!',
        'password_confirmation' => 'Autre-mot-de-passe-2026!', 'intended_profile' => 'agency',
    ])->assertUnprocessable()->assertJsonValidationErrors('email');
});

it('supporte deux suppressions successives de la même adresse', function (): void {
    supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();
    auth()->forgetGuards();

    $second = User::factory()->create(['email' => 'jean@exemple.fr', 'password' => MDP_COMPTE]);
    $this->jeton = $second->createToken('iphone', ['mobile'])->plainTextToken;

    supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();

    expect(User::withTrashed()->where('email', 'like', 'jean@exemple.fr-deleted-%')->count())->toBe(2);
});

it('exige le code 2FA quand la double authentification est active', function (): void {
    $secret = activerDeuxFacteurs($this->user);

    supprimer($this, ['password' => MDP_COMPTE])->assertForbidden();
    supprimer($this, ['code' => codeTotp($secret)])->assertNoContent();

    expect($this->user->fresh()?->deleted_at)->not->toBeNull();
});

it('accepte une session web ré-authentifiée récemment', function (): void {
    config(['sanctum.stateful' => ['agence.eguardimmo.test']]);

    $this->withSession([EnsureRecentReauthentication::CLE_MOT_DE_PASSE => now()->getTimestamp()])
        ->actingAs($this->user, 'web')
        ->deleteJson('/api/v1/me', [], ['Origin' => 'https://agence.eguardimmo.test', 'Referer' => 'https://agence.eguardimmo.test/'])
        ->assertNoContent();

    $this->assertGuest('web');
    expect(User::withTrashed()->find($this->user->id)?->deleted_at)->not->toBeNull();
});

it('verrouille le compte après des mots de passe erronés répétés, sous la limite de débit', function (): void {
    foreach (range(1, AccountLockout::ECHECS_MAX_PAR_HEURE) as $_) {
        supprimer($this, ['password' => 'faux'])->assertForbidden();
        $this->travel(1)->minutes();
    }

    supprimer($this, ['password' => MDP_COMPTE])->assertTooManyRequests();

    expect($this->user->fresh()?->deleted_at)->toBeNull();
});

it('retire le rôle opérateur et ses jetons', function (): void {
    $this->user->operator()->create(['granted_at' => now()])->roles()->create(['role' => 'admin', 'granted_at' => now()]);

    supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();

    expect($this->user->operator()->first()?->revoked_at)->not->toBeNull();
});

describe('comptes liés à Google ou Apple', function (): void {
    beforeEach(function (): void {
        configurerApple($this);
        $this->cle = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        config(['services.google.mobile_client_ids' => [AUD_GOOGLE]]);

        $this->apple = $this->user->socialIdentities()->create(['provider' => SocialProvider::Apple, 'subject' => 'a-001']);
        $this->apple->forceFill(['apple_refresh_token' => 'rt-apple-secret', 'apple_client_id' => 'fr.eguardimmo.app'])->save();
    });

    it('révoque le jeton Apple puis libère les identités sociales', function (): void {
        Http::fake([RevokeAppleToken::URL => Http::response()]);

        supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();

        Http::assertSent(fn (RequeteHttp $r): bool => $r->url() === RevokeAppleToken::URL
            && $r['token'] === 'rt-apple-secret'
            && $r['client_id'] === 'fr.eguardimmo.app'
            && $r['token_type_hint'] === 'refresh_token');

        $identite = SocialIdentity::query()->findOrFail($this->apple->id);
        expect($identite->subject)->toBe('a-001-deleted-'.$this->apple->id)
            ->and($identite->apple_refresh_token)->toBeNull();
    });

    it('considère un jeton Apple déjà invalide comme révoqué', function (): void {
        Http::fake([RevokeAppleToken::URL => Http::response(['error' => 'invalid_grant'], 400)]);

        supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();
    });

    it('supprime quand même le compte si la révocation Apple échoue, et garde le jeton pour la retenter', function (Closure $reponse): void {
        Exceptions::fake();
        Http::fake([RevokeAppleToken::URL => $reponse]);

        supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();

        Exceptions::assertReported(RuntimeException::class);
        $identite = SocialIdentity::query()->findOrFail($this->apple->id);
        expect(User::withTrashed()->find($this->user->id)?->deleted_at)->not->toBeNull()
            ->and($identite->subject)->toBe('a-001-deleted-'.$this->apple->id)
            ->and($identite->apple_refresh_token)->toBe('rt-apple-secret')
            ->and(AuditLog::query()->where('action', 'identity.apple.revocation_deferred')->count())->toBe(1);
    })->with([
        'erreur serveur' => [fn () => fn () => Http::response([], 500)],
        'client refusé' => [fn () => fn () => Http::response(['error' => 'invalid_client'], 400)],
        'connexion' => [fn () => fn () => throw new ConnectionException('injoignable')],
    ]);

    it('supprime quand même le compte si la configuration Apple manque', function (): void {
        Exceptions::fake();
        config(['services.apple.private_key_path' => null]);

        supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();

        Exceptions::assertReported(RuntimeException::class);
        Http::assertNothingSent();
        expect(SocialIdentity::query()->findOrFail($this->apple->id)->apple_refresh_token)->toBe('rt-apple-secret');
    });

    it('retente plus tard les révocations Apple en échec, sans toucher aux comptes actifs', function (): void {
        Exceptions::fake();
        $actif = User::factory()->create();
        $identiteActive = $actif->socialIdentities()->create(['provider' => SocialProvider::Apple, 'subject' => 'a-actif']);
        $identiteActive->forceFill(['apple_refresh_token' => 'rt-actif', 'apple_client_id' => 'fr.eguardimmo.app'])->save();

        Http::fake([RevokeAppleToken::URL => Http::sequence()->push([], 503)->push([], 503)->push()]);
        supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();

        $this->artisan('identity:revoke-deferred-apple-tokens')->assertFailed();
        expect($this->apple->fresh()?->apple_refresh_token)->toBe('rt-apple-secret');

        $this->artisan('identity:revoke-deferred-apple-tokens')->assertSuccessful();
        expect($this->apple->fresh()?->apple_refresh_token)->toBeNull()
            ->and($identiteActive->fresh()?->apple_refresh_token)->toBe('rt-actif')
            ->and(AuditLog::query()->where('action', 'identity.apple.revoked')->count())->toBe(1);
        Http::assertSentCount(3);
    });

    it('accepte un id_token frais du fournisseur lié', function (): void {
        Http::fake([
            VerifyIdentityToken::JWKS_GOOGLE => Http::response(jwks($this->cle)),
            RevokeAppleToken::URL => Http::response(),
        ]);
        $this->user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-123']);
        $this->user->forceFill(['password' => null])->save();

        supprimer($this, ['provider' => 'google', 'id_token' => idTokenGoogle($this->cle), 'nonce' => NONCE_MOBILE])->assertNoContent();
    });

    it('refuse un id_token déjà consommé par une connexion', function (): void {
        Http::fake([VerifyIdentityToken::JWKS_GOOGLE => Http::response(jwks($this->cle))]);
        $this->user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-123']);
        $idToken = idTokenGoogle($this->cle);

        $this->postJson('/api/v1/auth/social/google/token', ['id_token' => $idToken, 'nonce' => NONCE_MOBILE, 'device_name' => 'iPhone', 'intent' => 'login'])->assertCreated();
        auth()->forgetGuards();

        supprimer($this, ['provider' => 'google', 'id_token' => $idToken, 'nonce' => NONCE_MOBILE])->assertForbidden();
        expect($this->user->fresh()?->deleted_at)->toBeNull();
    });

    it('refuse un id_token d\'une identité qui n\'est pas liée au compte', function (): void {
        Http::fake([VerifyIdentityToken::JWKS_GOOGLE => Http::response(jwks($this->cle))]);

        supprimer($this, ['provider' => 'google', 'id_token' => idTokenGoogle($this->cle, ['sub' => 'g-autre']), 'nonce' => NONCE_MOBILE])
            ->assertForbidden();

        expect($this->user->fresh()?->deleted_at)->toBeNull();
    });

    it('permet une nouvelle connexion Google avec la même identité après suppression', function (): void {
        Http::fake([
            VerifyIdentityToken::JWKS_GOOGLE => Http::response(jwks($this->cle)),
            RevokeAppleToken::URL => Http::response(),
        ]);
        $this->user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-123']);

        supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();
        auth()->forgetGuards();

        $this->postJson('/api/v1/auth/social/google/token', [
            'id_token' => idTokenGoogle($this->cle, ['email' => 'nouveau@exemple.fr']), 'nonce' => NONCE_MOBILE,
            'device_name' => 'iPhone', 'intent' => 'login',
        ])->assertNotFound()->assertJsonPath('code', 'no_account');
    });
});

it('refuse une simple confirmation de mot de passe de session quand la 2FA est active', function (): void {
    config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
    activerDeuxFacteurs($this->user);
    $origine = ['Origin' => 'https://agence.eguardimmo.test', 'Referer' => 'https://agence.eguardimmo.test/'];

    $this->withSession([EnsureRecentReauthentication::CLE_MOT_DE_PASSE => now()->getTimestamp()])
        ->actingAs($this->user, 'web')
        ->deleteJson('/api/v1/me', [], $origine)
        ->assertForbidden();

    $this->withSession([EnsureRecentReauthentication::CLE_2FA => now()->getTimestamp()])
        ->actingAs($this->user, 'web')
        ->deleteJson('/api/v1/me', [], $origine)
        ->assertNoContent();
});

it('verrouille aussi la confirmation de mot de passe de Fortify', function (): void {
    foreach (range(1, AccountLockout::ECHECS_MAX_PAR_HEURE) as $n) {
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.2.'.$n])
            ->actingAs($this->user, 'web')
            ->postJson('/auth/user/confirm-password', ['password' => 'faux'])
            ->assertUnprocessable();
    }

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.3.1'])
        ->actingAs($this->user, 'web')
        ->postJson('/auth/user/confirm-password', ['password' => MDP_COMPTE])
        ->assertTooManyRequests();
});

it('limite les tentatives par compte et non par IP partagée', function (): void {
    foreach (range(1, HttpSecurityServiceProvider::LIMITE_REAUTHENTIFICATION_PAR_MINUTE) as $_) {
        supprimer($this, ['password' => 'faux']);
    }
    supprimer($this, ['password' => 'faux'])->assertTooManyRequests();

    $voisin = User::factory()->create(['password' => MDP_COMPTE]);
    $this->jeton = $voisin->createToken('iphone', ['mobile'])->plainTextToken;
    auth()->forgetGuards();

    supprimer($this, ['password' => MDP_COMPTE])->assertNoContent();
});

it('ne fait rien lors d\'une seconde suppression du même compte', function (): void {
    Event::fake([AccountDeleted::class]);

    app(DeleteAccount::class)->handle($this->user);
    app(DeleteAccount::class)->handle($this->user);

    Event::assertDispatchedTimes(AccountDeleted::class, 1);
    expect(User::withTrashed()->whereKey($this->user->id)->value('email'))->toBe('jean@exemple.fr-deleted-'.$this->user->id);
});

it('libère une identité sociale restée attachée à un compte supprimé au lieu d\'échouer', function (): void {
    $cle = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    config(['services.google.mobile_client_ids' => [AUD_GOOGLE]]);
    Http::fake([VerifyIdentityToken::JWKS_GOOGLE => Http::response(jwks($cle))]);
    $orpheline = $this->user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-123']);
    $this->user->forceFill(['email' => User::withDeletedMarker('jean@exemple.fr', $this->user->id)])->save();
    $this->user->delete();

    $this->postJson('/api/v1/auth/social/google/token', [
        'id_token' => idTokenGoogle($cle), 'nonce' => NONCE_MOBILE, 'device_name' => 'iPhone',
        'intent' => 'register', 'profile' => 'agency',
    ])->assertCreated();

    expect($orpheline->fresh()?->subject)->toBe('g-123-deleted-'.$orpheline->id)
        ->and(User::query()->where('email', 'jean@exemple.fr')->sole()->id)->not->toBe($this->user->id);
});
