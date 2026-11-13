<?php

declare(strict_types=1);

use App\Modules\Identity\Actions\ExchangeAppleAuthorizationCode;
use App\Modules\Identity\Actions\VerifyIdentityToken;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Models\PersonalAccessToken;
use App\Modules\Identity\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as RequeteHttp;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

beforeEach(function (): void {
    config([
        'services.google.mobile_client_ids' => [AUD_GOOGLE, 'android-client.apps.googleusercontent.com'],
        'services.apple.bundle_id' => 'fr.eguardimmo.app',
    ]);

    $this->cle = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    Http::preventStrayRequests();
    $this->jwksGoogle = fn () => Http::response(jwks($this->cle));
    Http::fake([
        VerifyIdentityToken::JWKS_GOOGLE => fn (RequeteHttp $requete) => ($this->jwksGoogle)($requete),
        VerifyIdentityToken::JWKS_APPLE => fn () => Http::response(jwks($this->cle)),
    ]);
});

function connexionSociale(mixed $test, string $fournisseur, string $idToken, array $extra = []): mixed
{
    return $test->postJson('/api/v1/auth/social/'.$fournisseur.'/token', array_merge([
        'id_token' => $idToken,
        'nonce' => NONCE_MOBILE,
        'device_name' => 'iPhone de Jean',
        'intent' => 'login',
    ], $extra));
}

function compteGoogle(): User
{
    $user = User::factory()->create(['email' => 'jean@exemple.fr']);
    $user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-123']);

    return $user;
}

it('délivre un jeton mobile pour un id_token Google valide', function (): void {
    $user = compteGoogle();

    $jeton = connexionSociale($this, 'google', idTokenGoogle($this->cle))
        ->assertCreated()
        ->assertJsonPath('data.two_factor', false)
        ->json('data.token');

    expect(PersonalAccessToken::findToken($jeton)?->tokenable?->is($user))->toBeTrue()
        ->and(PersonalAccessToken::findToken($jeton)?->abilities)->toBe(['mobile']);
});

it('inscrit un nouveau compte depuis le mobile', function (): void {
    connexionSociale($this, 'google', idTokenGoogle($this->cle), ['intent' => 'register', 'profile' => 'traveler'])->assertCreated();

    expect(User::query()->where('email', 'jean@exemple.fr')->first()?->hasVerifiedEmail())->toBeTrue();
});

it('répond 404 no_account à une connexion sans compte', function (): void {
    connexionSociale($this, 'google', idTokenGoogle($this->cle))->assertNotFound()->assertJsonPath('code', 'no_account');
});

it('rejette un id_token invalide', function (Closure $jeton): void {
    compteGoogle();

    connexionSociale($this, 'google', $jeton($this->cle))->assertUnprocessable()->assertJsonPath('code', 'invalid_id_token');
    expect(PersonalAccessToken::query()->count())->toBe(0);
})->with([
    'signature d\'une autre clé' => [fn ($cle): string => idTokenGoogle(openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]))],
    'audience étrangère' => [fn ($cle): string => idTokenGoogle($cle, ['aud' => 'autre-app.apps.googleusercontent.com', 'azp' => 'autre-app.apps.googleusercontent.com'])],
    'audience multiple avec une étrangère' => [fn ($cle): string => idTokenGoogle($cle, ['aud' => [AUD_GOOGLE, 'autre']])],
    'azp étranger' => [fn ($cle): string => idTokenGoogle($cle, ['azp' => 'autre-app'])],
    'émetteur étranger' => [fn ($cle): string => idTokenGoogle($cle, ['iss' => 'https://evil.example'])],
    'émetteur Apple sur Google' => [fn ($cle): string => idTokenGoogle($cle, ['iss' => 'https://appleid.apple.com'])],
    'expiré' => [fn ($cle): string => idTokenGoogle($cle, ['exp' => now()->subMinutes(2)->getTimestamp()])],
    'émis dans le futur' => [fn ($cle): string => idTokenGoogle($cle, ['iat' => now()->addMinutes(5)->getTimestamp(), 'nbf' => now()->addMinutes(5)->getTimestamp()])],
    'nonce faux' => [fn ($cle): string => idTokenGoogle($cle, ['nonce' => 'autre-nonce-0123456789'])],
    'sans nonce' => [fn ($cle): string => idTokenGoogle($cle, ['nonce' => null])],
    'sans sub' => [fn ($cle): string => idTokenGoogle($cle, ['sub' => ''])],
    'kid inconnu' => [fn ($cle): string => idTokenGoogle($cle, [], 'cle-inconnue')],
    'HS256' => [fn ($cle): string => JWT::encode(['sub' => 'g-123', 'aud' => AUD_GOOGLE, 'iss' => 'https://accounts.google.com', 'nonce' => NONCE_MOBILE, 'exp' => now()->addHour()->getTimestamp()], 'secret-quelconque-assez-long-pour-hs256', 'HS256', 'cle-1')],
    'alg none' => [fn ($cle): string => rtrim(strtr(base64_encode('{"alg":"none","kid":"cle-1"}'), '+/', '-_'), '=').'.'.rtrim(strtr(base64_encode('{"sub":"g-123"}'), '+/', '-_'), '=').'.'],
    'format' => [fn ($cle): string => 'pas-un-jwt'],
]);

it('refuse le rattachement automatique si Google n\'atteste pas l\'e-mail', function (): void {
    User::factory()->create(['email' => 'jean@exemple.fr']);

    connexionSociale($this, 'google', idTokenGoogle($this->cle, ['email_verified' => false]))
        ->assertConflict()
        ->assertJsonPath('code', 'account_exists_link_required');
});

it('répond 503 sans rien mettre en cache si le JWKS est en panne', function (Closure $panne): void {
    compteGoogle();
    $this->jwksGoogle = $panne;
    $jeton = idTokenGoogle($this->cle);

    connexionSociale($this, 'google', $jeton)->assertStatus(503)->assertJsonPath('code', 'provider_unavailable');

    expect(Cache::has('identity:jwks:google'))->toBeFalse()
        ->and(Cache::has('identity:id-token:'.hash('sha256', $jeton)))->toBeFalse();
})->with([
    'erreur 500' => [fn () => Http::response('panne', 500)],
    'connexion' => [fn () => throw new ConnectionException('délai dépassé')],
    'JSON vide' => [fn () => Http::response(['keys' => []])],
    'clé illisible' => [fn () => Http::response(['keys' => [['kty' => 'RSA', 'kid' => 'cle-1']]])],
]);

it('se remet d\'une panne du JWKS dès qu\'il répond de nouveau', function (): void {
    compteGoogle();
    $this->jwksGoogle = Http::sequence()->push('panne', 500)->push(jwks($this->cle));

    connexionSociale($this, 'google', idTokenGoogle($this->cle))->assertStatus(503);
    connexionSociale($this, 'google', idTokenGoogle($this->cle, ['jti' => 'autre']))->assertCreated();
});

it('ne recharge le JWKS qu\'une fois par minute pour un kid inconnu', function (): void {
    compteGoogle();

    connexionSociale($this, 'google', idTokenGoogle($this->cle, [], 'cle-inconnue'))->assertUnprocessable();
    connexionSociale($this, 'google', idTokenGoogle($this->cle, ['jti' => 'b'], 'cle-inconnue'))->assertUnprocessable();
    connexionSociale($this, 'google', idTokenGoogle($this->cle, ['jti' => 'c'], 'cle-inconnue'))->assertUnprocessable();

    Http::assertSentCount(2);
});

it('n\'appelle pas le JWKS pour un en-tête refusé', function (): void {
    connexionSociale($this, 'google', 'eyJhbGciOiJub25lIn0.e30.')->assertUnprocessable();

    Http::assertNothingSent();
});

it('rejette un id_token rejoué', function (): void {
    compteGoogle();
    $jeton = idTokenGoogle($this->cle);

    connexionSociale($this, 'google', $jeton)->assertCreated();
    connexionSociale($this, 'google', $jeton)->assertUnprocessable()->assertJsonPath('code', 'invalid_id_token');

    expect(PersonalAccessToken::query()->count())->toBe(1);
});

it('renvoie un défi si le compte a la 2FA', function (): void {
    $user = compteGoogle();
    activerDeuxFacteurs($user);

    connexionSociale($this, 'google', idTokenGoogle($this->cle))
        ->assertCreated()
        ->assertJsonPath('data.two_factor', true)
        ->assertJsonMissingPath('data.token');

    expect(PersonalAccessToken::query()->count())->toBe(0);
});

it('vérifie le nonce Apple sous forme de SHA-256', function (): void {
    $user = User::factory()->create();
    $user->socialIdentities()->create(['provider' => SocialProvider::Apple, 'subject' => 'a-001']);

    connexionSociale($this, 'apple', idTokenApple($this->cle))->assertCreated();
    connexionSociale($this, 'apple', idTokenApple($this->cle, ['nonce' => NONCE_MOBILE, 'jti' => 'x']))->assertUnprocessable();
});

it('rejette un id_token Apple destiné à une autre application', function (): void {
    connexionSociale($this, 'apple', idTokenApple($this->cle, ['aud' => 'com.autre.app']))->assertUnprocessable();
});

describe('échange du code Apple', function (): void {
    beforeEach(function (): void {
        $cleEc = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        openssl_pkey_export($cleEc, $pem);
        $this->cheminCle = (string) tempnam(sys_get_temp_dir(), 'apple-p8-');
        file_put_contents($this->cheminCle, $pem);

        config(['services.apple.team_id' => 'EQUIPE1234', 'services.apple.key_id' => 'CLE1234567', 'services.apple.private_key_path' => $this->cheminCle]);

        $this->user = User::factory()->create();
        $this->user->socialIdentities()->create(['provider' => SocialProvider::Apple, 'subject' => 'a-001']);
    });

    afterEach(function (): void {
        @unlink($this->cheminCle);
    });

    it('stocke chiffré le refresh token obtenu par l\'échange du code', function (): void {
        Http::fake([ExchangeAppleAuthorizationCode::URL => Http::response(['id_token' => idTokenApple($this->cle), 'refresh_token' => 'rt-apple-secret'])]);

        connexionSociale($this, 'apple', idTokenApple($this->cle), ['authorization_code' => 'code-apple'])->assertCreated();

        $identite = $this->user->socialIdentities()->firstOrFail();
        expect($identite->apple_refresh_token)->toBe('rt-apple-secret')
            ->and((string) DB::table('social_identities')->where('id', $identite->id)->value('apple_refresh_token'))->not->toContain('rt-apple-secret');

        Http::assertSent(fn (RequeteHttp $r): bool => $r->url() === ExchangeAppleAuthorizationCode::URL
            && $r['client_id'] === 'fr.eguardimmo.app'
            && $r['grant_type'] === 'authorization_code'
            && JWT::jsonDecode(JWT::urlsafeB64Decode(explode('.', (string) $r['client_secret'])[1]))->sub === 'fr.eguardimmo.app');
    });

    it('accepte le même id_token et le même code pour s\'inscrire après un refus no_account', function (): void {
        Http::fake([ExchangeAppleAuthorizationCode::URL => Http::response(['id_token' => idTokenApple($this->cle, ['sub' => 'a-nouveau']), 'refresh_token' => 'rt'])]);
        $jeton = idTokenApple($this->cle, ['sub' => 'a-nouveau', 'email' => 'nouveau@exemple.fr']);

        connexionSociale($this, 'apple', $jeton, ['authorization_code' => 'code-apple'])->assertNotFound();
        connexionSociale($this, 'apple', $jeton, ['authorization_code' => 'code-apple', 'intent' => 'register', 'profile' => 'traveler'])->assertCreated();

        Http::assertSentCount(2);
        expect(User::query()->where('email', 'nouveau@exemple.fr')->exists())->toBeTrue();
    });

    it('annule l\'inscription si l\'échange du code Apple échoue', function (): void {
        Http::fake([ExchangeAppleAuthorizationCode::URL => Http::response(['error' => 'invalid_grant'], 400)]);

        connexionSociale($this, 'apple', idTokenApple($this->cle, ['sub' => 'a-nouveau', 'email' => 'nouveau@exemple.fr']), ['authorization_code' => 'code-apple', 'intent' => 'register', 'profile' => 'traveler'])
            ->assertUnprocessable();

        expect(User::query()->where('email', 'nouveau@exemple.fr')->exists())->toBeFalse();
    });

    it('rejette un code dont le sujet ne correspond pas', function (): void {
        Http::fake([ExchangeAppleAuthorizationCode::URL => Http::response(['id_token' => idTokenApple($this->cle, ['sub' => 'a-autre']), 'refresh_token' => 'rt'])]);

        connexionSociale($this, 'apple', idTokenApple($this->cle), ['authorization_code' => 'code-apple'])->assertUnprocessable();
        expect(PersonalAccessToken::query()->count())->toBe(0);
    });

    it('répond 503 si Apple est en panne et 422 si le code est refusé', function (int $statut, int $attendu): void {
        Http::fake([ExchangeAppleAuthorizationCode::URL => Http::response(['error' => 'x'], $statut)]);

        connexionSociale($this, 'apple', idTokenApple($this->cle), ['authorization_code' => 'code-apple'])->assertStatus($attendu);
    })->with([
        [500, 503],
        [400, 422],
    ]);
});

it('valide les champs de la requête', function (array $corps, string $champ): void {
    $this->postJson('/api/v1/auth/social/google/token', array_merge([
        'id_token' => 'x.y.z', 'nonce' => NONCE_MOBILE, 'device_name' => 'iPhone', 'intent' => 'login',
    ], $corps))->assertUnprocessable()->assertJsonValidationErrors($champ);
})->with([
    [['nonce' => 'court'], 'nonce'],
    [['intent' => 'link'], 'intent'],
    [['intent' => 'register'], 'profile'],
    [['intent' => 'register', 'profile' => 'tenant'], 'profile'],
    [['device_name' => ''], 'device_name'],
]);

it('refuse un fournisseur inconnu', function (): void {
    $this->postJson('/api/v1/auth/social/github/token', [])->assertNotFound();
});
