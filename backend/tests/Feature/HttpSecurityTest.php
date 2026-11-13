<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Providers\HttpSecurityServiceProvider;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

afterEach(function (): void {
    TrustProxies::flushState();
});

it('bloque un client anonyme au-delà de la limite par IP sur une route publique', function (): void {
    Route::middleware('api')->get('/api/v1/sonde-publique', fn (): array => ['ok' => true]);

    for ($i = 0; $i < HttpSecurityServiceProvider::LIMITE_ANONYME_PAR_MINUTE; $i++) {
        $this->getJson('/api/v1/sonde-publique')
            ->assertOk()
            ->assertHeader('X-RateLimit-Limit', (string) HttpSecurityServiceProvider::LIMITE_ANONYME_PAR_MINUTE);
    }

    $this->getJson('/api/v1/sonde-publique')
        ->assertTooManyRequests()
        ->assertHeader('Retry-After');
});

it('applique la limite large par utilisateur à un porteur de jeton', function (): void {
    $user = User::factory()->create();
    $jeton = $user->createToken('mobile')->plainTextToken;

    for ($i = 0; $i < HttpSecurityServiceProvider::LIMITE_ANONYME_PAR_MINUTE + 5; $i++) {
        $this->withToken($jeton)->getJson('/api/v1/me')
            ->assertOk()
            ->assertHeader('X-RateLimit-Limit', (string) HttpSecurityServiceProvider::LIMITE_UTILISATEUR_PAR_MINUTE);
    }
});

it('limite les tentatives d\'authentification par compte et par IP', function (): void {
    $limites = RateLimiter::limiter('auth')(Request::create('/', 'POST', ['email' => ' Jean@Exemple.fr ']));

    expect($limites)->toHaveCount(2)
        ->and($limites[0]->maxAttempts)->toBe(HttpSecurityServiceProvider::LIMITE_AUTH_PAR_COMPTE_PAR_MINUTE)
        ->and($limites[0]->key)->toStartWith('auth-compte:jean@exemple.fr|')
        ->and($limites[1]->maxAttempts)->toBe(HttpSecurityServiceProvider::LIMITE_AUTH_PAR_IP_PAR_MINUTE);
});

it('autorise le CORS avec cookies pour une origine de la liste blanche', function (): void {
    $this->call('OPTIONS', '/api/v1/me', server: [
        'HTTP_ORIGIN' => 'http://localhost:3000',
        'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
    ])
        ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:3000')
        ->assertHeader('Access-Control-Allow-Credentials', 'true');
});

it('refuse le CORS pour une origine inconnue', function (): void {
    $reponse = $this->call('OPTIONS', '/api/v1/me', server: [
        'HTTP_ORIGIN' => 'https://attaquant.example',
        'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
    ]);

    expect($reponse->headers->get('Access-Control-Allow-Origin'))->not->toBe('https://attaquant.example');
});

it('ne fait confiance à aucun proxy par défaut', function (): void {
    $requete = Request::create('/', server: ['REMOTE_ADDR' => '10.0.0.1', 'HTTP_X_FORWARDED_FOR' => '203.0.113.9']);

    (new TrustProxies)->handle($requete, fn (Request $r) => response(''));

    expect($requete->ip())->toBe('10.0.0.1');
});

it('lit l\'IP client derrière un proxy déclaré dans TRUSTED_PROXIES', function (): void {
    config(['app.trusted_proxies' => ['10.0.0.1']]);
    (new HttpSecurityServiceProvider(app()))->boot();

    $requete = Request::create('/', server: ['REMOTE_ADDR' => '10.0.0.1', 'HTTP_X_FORWARDED_FOR' => '203.0.113.9']);
    (new TrustProxies)->handle($requete, fn (Request $r) => response(''));

    expect($requete->ip())->toBe('203.0.113.9');
});

it('expire les jetons personnels après 30 jours par défaut', function (): void {
    expect(config('sanctum.expiration'))->toBe(60 * 24 * 30);
});
