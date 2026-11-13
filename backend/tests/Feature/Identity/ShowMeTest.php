<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;

it('refuse /me sans jeton', function (): void {
    $this->getJson('/api/v1/me')->assertUnauthorized();
});

it('renvoie un 401 JSON même sans en-tête Accept JSON', function (): void {
    $this->get('/api/v1/me', ['Accept' => 'text/html'])
        ->assertUnauthorized()
        ->assertHeader('Content-Type', 'application/problem+json')
        ->assertJsonPath('code', 'unauthenticated');
});

it('refuse un jeton invalide', function (): void {
    $this->withToken('1|jeton-invalide')->getJson('/api/v1/me')->assertUnauthorized();
});

it('retourne l\'utilisateur porteur d\'un vrai jeton, sans champ sensible', function (): void {
    $user = User::factory()->create();
    $jeton = $user->createToken('test')->plainTextToken;

    $this->withToken($jeton)
        ->getJson('/api/v1/me')
        ->assertOk()
        ->assertJsonPath('data.id', $user->id)
        ->assertJsonPath('data.email', $user->email)
        ->assertJsonMissingPath('data.password')
        ->assertJsonMissingPath('data.remember_token');
});

it('expose le health check', function (): void {
    $this->get('/up')->assertOk();
});
