<?php

declare(strict_types=1);

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\Route;

beforeEach(function (): void {
    Route::middleware('api')->prefix('api/v1/sonde')->group(function (): void {
        Route::get('/panne', fn () => throw new RuntimeException('SQLSTATE[42S02]: SELECT * FROM users WHERE password = x'));
        Route::get('/metier', fn () => throw ErrorCode::ProviderUnavailable->problem());
        Route::post('/validation', fn () => request()->validate(['email' => ['required', 'email']]));
    });
});

it('rend un 401 au format RFC 9457', function (): void {
    $reponse = $this->getJson('/api/v1/me');

    $reponse->assertUnauthorized()
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertExactJson([
            'type' => 'https://api.eguardimmo.test/problems/unauthenticated',
            'title' => 'Non authentifié',
            'status' => 401,
            'detail' => 'Connectez-vous pour continuer.',
            'code' => 'unauthenticated',
            'request_id' => $reponse->headers->get('X-Request-Id'),
        ]);
});

it('rend une erreur métier avec son code, son statut et Retry-After', function (): void {
    $this->getJson('/api/v1/sonde/metier')
        ->assertStatus(503)
        ->assertHeader('Retry-After', '30')
        ->assertJsonPath('code', 'provider_unavailable')
        ->assertJsonPath('title', 'Fournisseur injoignable')
        ->assertJsonPath('retry_after', 30);
});

it('garde les erreurs de validation sous errors', function (): void {
    $this->postJson('/api/v1/sonde/validation', ['email' => 'pas-un-email'])
        ->assertUnprocessable()
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('code', 'validation_failed')
        ->assertJsonValidationErrors('email');
});

it('ne révèle rien d\'une erreur interne, même en mode debug', function (): void {
    config(['app.debug' => true]);

    $reponse = $this->getJson('/api/v1/sonde/panne')->assertStatus(500);

    $reponse->assertExactJson([
        'type' => 'https://api.eguardimmo.test/problems/server_error',
        'title' => 'Erreur interne',
        'status' => 500,
        'detail' => 'Une erreur interne est survenue. Réessayez plus tard.',
        'code' => 'server_error',
        'request_id' => $reponse->headers->get('X-Request-Id'),
    ]);
    expect($reponse->getContent())->not->toContain('SQLSTATE')->not->toContain('RuntimeException');
});

it('ne révèle ni le chemin ni le modèle sur un 404', function (): void {
    $jetonDAutrui = User::factory()->create()->createToken('Pixel', ['mobile']);
    $appelant = User::factory()->create();

    $this->withToken($appelant->createToken('t', ['mobile'])->plainTextToken)
        ->deleteJson('/api/v1/me/devices/'.$jetonDAutrui->accessToken->id)
        ->assertNotFound()
        ->assertJsonPath('code', 'not_found')
        ->assertJsonPath('detail', 'La ressource demandée est introuvable.');

    $contenu = (string) $this->getJson('/api/v1/route-inconnue')->assertNotFound()->getContent();
    expect($contenu)->not->toContain('route-inconnue')->not->toContain('App\\');
});

it('rend un 405 pour une méthode non permise', function (): void {
    $this->putJson('/api/v1/me')->assertStatus(405)->assertJsonPath('code', 'method_not_allowed');
});

it('rend un 429 avec retry_after', function (): void {
    foreach (range(1, 5) as $ignore) {
        $this->postJson('/api/v1/auth/token', ['email' => 'x@exemple.fr', 'password' => 'faux', 'device_name' => 'iPhone']);
    }

    $reponse = $this->postJson('/api/v1/auth/token', ['email' => 'x@exemple.fr', 'password' => 'faux', 'device_name' => 'iPhone'])
        ->assertTooManyRequests()
        ->assertJsonPath('code', 'too_many_requests');

    expect($reponse->json('retry_after'))->toBeInt()->toBeGreaterThan(0)
        ->and($reponse->headers->get('Retry-After'))->toBe((string) $reponse->json('retry_after'));
});

it('donne un statut, un titre et un détail à chaque code d\'Identity', function (ErrorCode $code): void {
    $probleme = $code->problem();

    expect($probleme->problemCode)->toBe($code->value)
        ->and($probleme->status)->toBeGreaterThanOrEqual(400)
        ->and($probleme->title)->not->toBeEmpty()
        ->and($probleme->getMessage())->not->toBeEmpty();
})->with(ErrorCode::cases());
