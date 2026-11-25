<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Enums\SocialIntentType;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Social\OAuthState;
use Illuminate\Support\Facades\Crypt;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as OAuthUser;

beforeEach(function (): void {
    config([
        'services.google.client_id' => 'web-client.apps.googleusercontent.com',
        'services.google.client_secret' => 'secret-de-test',
    ]);
});

function utilisateurGoogle(string $sujet = 'g-123', string $email = 'jean@exemple.fr', bool $verifie = true): OAuthUser
{
    return (new OAuthUser)->setRaw(['sub' => $sujet, 'email' => $email, 'email_verified' => $verifie])
        ->map(['id' => $sujet, 'email' => $email, 'name' => 'Jean Dupont']);
}

/**
 * @return array{string, string}
 */
function etatOAuth(SocialIntentType $intention = SocialIntentType::Login, ?string $userId = null, string $retour = 'https://agence.eguardimmo.test/tableau', ?IntendedProfile $profil = null): array
{
    [, $chiffre, $binder] = OAuthState::issue(SocialProvider::Google, $intention, $profil, $retour, $userId);

    return [$chiffre, $binder];
}

function rappelGoogle(mixed $test, string $state, ?string $binder): mixed
{
    $requete = $binder !== null ? $test->withCookie(OAuthState::COOKIE_BINDER, $binder) : $test;

    return $requete->get('/auth/social/google/callback?'.http_build_query(['state' => $state, 'code' => 'code-de-test']));
}

it('redirige vers le fournisseur avec un state chiffré, le cookie binder et un retour assaini', function (string $retour, string $attendu): void {
    $reponse = $this->get('/auth/social/google/redirect?'.http_build_query(['intent' => 'login', 'return_to' => $retour]));

    $reponse->assertRedirect()->assertCookie(OAuthState::COOKIE_BINDER)->assertHeader('Referrer-Policy', 'no-referrer');

    parse_str((string) parse_url((string) $reponse->headers->get('Location'), PHP_URL_QUERY), $parametres);
    $etat = json_decode(Crypt::decryptString((string) $parametres['state']), true);

    expect($etat['r'])->toBe($attendu)->and($etat['i'])->toBe('login');
})->with([
    'autorisé' => ['https://agence.eguardimmo.test/tableau', 'https://agence.eguardimmo.test/tableau'],
    'piégé' => ['https://evil.example/', 'https://auth.eguardimmo.test/'],
]);

it('refuse l\'intention link en GET et une inscription sans profil', function (array $requete): void {
    $this->getJson('/auth/social/google/redirect?'.http_build_query($requete))->assertUnprocessable();
})->with([
    'link' => [['intent' => 'link']],
    'register sans profil' => [['intent' => 'register']],
    'profil locataire' => [['intent' => 'register', 'profile' => 'tenant']],
]);

it('refuse un fournisseur inconnu', function (): void {
    $this->get('/auth/social/github/redirect?intent=login')->assertNotFound();
});

it('ouvre la session au rappel et redirige vers le retour', function (): void {
    $user = User::factory()->create();
    $user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-123']);
    Socialite::fake('google', utilisateurGoogle());
    [$state, $binder] = etatOAuth();

    rappelGoogle($this, $state, $binder)
        ->assertStatus(303)
        ->assertRedirect('https://agence.eguardimmo.test/tableau')
        ->assertHeader('Referrer-Policy', 'no-referrer');

    $this->assertAuthenticatedAs($user, 'web');
});

it('accepte le rappel en POST (Apple form_post)', function (): void {
    $user = User::factory()->create();
    $user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-123']);
    Socialite::fake('google', utilisateurGoogle());
    [$state, $binder] = etatOAuth();

    $this->withCookie(OAuthState::COOKIE_BINDER, $binder)
        ->post('/auth/social/google/callback', ['state' => $state, 'code' => 'x'])
        ->assertStatus(303);

    $this->assertAuthenticatedAs($user, 'web');
});

it('refuse un state altéré, absent ou d\'un autre fournisseur', function (Closure $state): void {
    Socialite::fake('google', utilisateurGoogle());
    [, $binder] = etatOAuth();

    rappelGoogle($this, $state(), $binder)->assertStatus(303)->assertRedirect('https://auth.eguardimmo.test/connexion?'.http_build_query(['erreur' => 'invalid_state', 'return_to' => 'https://auth.eguardimmo.test/']));
    $this->assertGuest('web');
})->with([
    'altéré' => [fn (): string => substr(etatOAuth()[0], 0, -4).'AAAA'],
    'vide' => [fn (): string => ''],
    'autre fournisseur' => [fn (): string => OAuthState::issue(SocialProvider::Apple, SocialIntentType::Login, null, 'https://auth.eguardimmo.test/', null)[1]],
]);

it('refuse un state rejoué', function (): void {
    $user = User::factory()->create();
    $user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-123']);
    Socialite::fake('google', utilisateurGoogle());
    [$state, $binder] = etatOAuth();

    rappelGoogle($this, $state, $binder)->assertStatus(303);
    auth('web')->logout();

    rappelGoogle($this, $state, $binder)->assertStatus(303)->assertRedirect('https://auth.eguardimmo.test/connexion?'.http_build_query(['erreur' => 'invalid_state', 'return_to' => 'https://auth.eguardimmo.test/']));
});

it('refuse un state expiré', function (): void {
    Socialite::fake('google', utilisateurGoogle());
    [$state, $binder] = etatOAuth();

    $this->travel(11)->minutes();

    rappelGoogle($this, $state, $binder)->assertStatus(303)->assertRedirect('https://auth.eguardimmo.test/connexion?'.http_build_query(['erreur' => 'invalid_state', 'return_to' => 'https://auth.eguardimmo.test/']));
});

it('refuse un rappel sans le cookie binder ou avec celui d\'un autre navigateur', function (?string $binder): void {
    Socialite::fake('google', utilisateurGoogle());
    [$state] = etatOAuth();

    rappelGoogle($this, $state, $binder)->assertStatus(303)->assertRedirect('https://auth.eguardimmo.test/connexion?'.http_build_query(['erreur' => 'invalid_state', 'return_to' => 'https://auth.eguardimmo.test/']));
    $this->assertGuest('web');
})->with([
    'absent' => [null],
    'autre' => [str_repeat('a', 64)],
]);

it('redirige vers le défi 2FA sans ouvrir de session si le compte a la 2FA', function (): void {
    $user = User::factory()->create();
    activerDeuxFacteurs($user);
    $user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-123']);
    Socialite::fake('google', utilisateurGoogle());
    [$state, $binder] = etatOAuth();

    rappelGoogle($this, $state, $binder)
        ->assertStatus(303)
        ->assertRedirect('https://auth.eguardimmo.test/connexion/verification?'.http_build_query(['return_to' => 'https://agence.eguardimmo.test/tableau']))
        ->assertSessionHas('login.id', $user->id);

    $this->assertGuest('web');
});

it('ouvre la session après un défi 2FA réussi à la suite du retour Google, et la refuse avec un mauvais code', function (): void {
    $user = User::factory()->create();
    $secret = activerDeuxFacteurs($user);
    $user->socialIdentities()->create(['provider' => SocialProvider::Google, 'subject' => 'g-123']);
    Socialite::fake('google', utilisateurGoogle());
    [$state, $binder] = etatOAuth();

    rappelGoogle($this, $state, $binder)->assertStatus(303)->assertSessionHas('login.id', $user->id);

    $this->postJson('/auth/two-factor-challenge', ['code' => '000000'])->assertUnprocessable();
    $this->assertGuest('web');

    $this->postJson('/auth/two-factor-challenge', ['code' => codeTotp($secret)])->assertNoContent();
    $this->assertAuthenticatedAs($user, 'web');
});

it('renvoie vers le hub avec le code d\'erreur si aucun compte n\'existe', function (): void {
    Socialite::fake('google', utilisateurGoogle());
    [$state, $binder] = etatOAuth();

    rappelGoogle($this, $state, $binder)
        ->assertStatus(303)
        ->assertRedirect('https://auth.eguardimmo.test/connexion?'.http_build_query(['erreur' => 'no_account', 'return_to' => 'https://agence.eguardimmo.test/tableau']));
    $this->assertGuest('web');
});

it('inscrit un nouveau compte par Google', function (): void {
    Socialite::fake('google', utilisateurGoogle(email: 'nouveau@exemple.fr'));
    [$state, $binder] = etatOAuth(SocialIntentType::Register, profil: IntendedProfile::Agency);

    rappelGoogle($this, $state, $binder)->assertStatus(303);

    $user = User::query()->where('email', 'nouveau@exemple.fr')->firstOrFail();
    expect($user->hasVerifiedEmail())->toBeTrue();
    $this->assertAuthenticatedAs($user, 'web');
});

it('renvoie vers le hub si le fournisseur échoue', function (): void {
    Socialite::fake('google', fn () => throw new RuntimeException('code invalide'));
    [$state, $binder] = etatOAuth();

    rappelGoogle($this, $state, $binder)
        ->assertStatus(303)
        ->assertRedirectContains('erreur=provider_error');
});

it('exige une ré-authentification récente pour lier un fournisseur', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user, 'web')->postJson('/auth/social/google/link')
        ->assertForbidden()
        ->assertJsonPath('code', 'reauthentication_required');
});

it('refuse la liaison à un compte dont l\'e-mail n\'est pas vérifié', function (): void {
    $user = User::factory()->unverified()->create();

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => now()->getTimestamp()])
        ->postJson('/auth/social/google/link')
        ->assertForbidden();
});

it('pose le cookie binder avec le préfixe __Host-', function (): void {
    $cookie = collect($this->get('/auth/social/google/redirect?intent=login')->headers->getCookies())
        ->first(fn ($c): bool => $c->getName() === OAuthState::COOKIE_BINDER);

    expect($cookie?->getName())->toStartWith('__Host-')
        ->and($cookie?->getPath())->toBe('/')
        ->and($cookie?->isSecure())->toBeTrue()
        ->and($cookie?->getDomain())->toBeNull();
});

it('refuse la liaison sans session', function (): void {
    $this->postJson('/auth/social/google/link')->assertUnauthorized();
});

it('délivre l\'URL de liaison après ré-authentification', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user, 'web')
        ->withSession(['auth.password_confirmed_at' => now()->getTimestamp()])
        ->postJson('/auth/social/google/link', ['return_to' => 'https://agence.eguardimmo.test/profil'])
        ->assertOk()
        ->assertJsonStructure(['data' => ['url']])
        ->assertCookie(OAuthState::COOKIE_BINDER);
});

it('expire la ré-authentification après la fenêtre configurée', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user, 'web')
        ->withSession(['auth.reauthenticated_at' => now()->subMinutes(11)->getTimestamp()])
        ->postJson('/auth/social/google/link')
        ->assertForbidden();
});

it('lie le fournisseur au compte connecté au rappel', function (): void {
    $user = User::factory()->create(['email' => 'jean@exemple.fr']);
    Socialite::fake('google', utilisateurGoogle(email: 'jean.perso@gmail.com', verifie: false));
    [$state, $binder] = etatOAuth(SocialIntentType::Link, $user->id, 'https://agence.eguardimmo.test/profil');

    $this->actingAs($user, 'web');
    rappelGoogle($this, $state, $binder)->assertStatus(303)->assertRedirect('https://agence.eguardimmo.test/profil');

    expect($user->socialIdentities()->where('subject', 'g-123')->exists())->toBeTrue();
});

it('refuse un rappel de liaison émis pour un autre compte', function (): void {
    $victime = User::factory()->create();
    $attaquant = User::factory()->create();
    Socialite::fake('google', utilisateurGoogle());
    [$state, $binder] = etatOAuth(SocialIntentType::Link, $attaquant->id);

    $this->actingAs($victime, 'web');
    rappelGoogle($this, $state, $binder)->assertStatus(303)->assertRedirect('https://auth.eguardimmo.test/connexion?'.http_build_query(['erreur' => 'invalid_state', 'return_to' => 'https://auth.eguardimmo.test/']));

    expect($victime->socialIdentities()->count())->toBe(0)
        ->and($attaquant->socialIdentities()->count())->toBe(0);
});

it('refuse un rappel de liaison sans session', function (): void {
    $user = User::factory()->create();
    Socialite::fake('google', utilisateurGoogle());
    [$state, $binder] = etatOAuth(SocialIntentType::Link, $user->id);

    rappelGoogle($this, $state, $binder)->assertStatus(303)->assertRedirect('https://auth.eguardimmo.test/connexion?'.http_build_query(['erreur' => 'invalid_state', 'return_to' => 'https://auth.eguardimmo.test/']));
});
