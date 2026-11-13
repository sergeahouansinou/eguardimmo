<?php

declare(strict_types=1);

it('attribue un identifiant UUID v7 à chaque réponse', function (): void {
    $identifiant = $this->getJson('/up')->headers->get('X-Request-Id');

    expect($identifiant)->toBeUuid()
        ->and(substr((string) $identifiant, 14, 1))->toBe('7');
});

it('reprend un identifiant fourni s\'il est un UUID', function (): void {
    $this->withHeader('X-Request-Id', '01934F6E-0000-7000-8000-000000000001')
        ->getJson('/up')
        ->assertHeader('X-Request-Id', '01934f6e-0000-7000-8000-000000000001');
});

it('remplace un identifiant fourni mal formé', function (string $valeur): void {
    $identifiant = $this->withHeader('X-Request-Id', $valeur)->getJson('/up')->headers->get('X-Request-Id');

    expect($identifiant)->toBeUuid()->not->toBe($valeur);
})->with([
    'texte' => ['abc'],
    'injection' => ["x\r\nSet-Cookie: a=b"],
    'trop long' => [str_repeat('a', 500)],
]);

it('expose l\'identifiant dans le corps des erreurs', function (): void {
    $reponse = $this->getJson('/api/v1/me')->assertUnauthorized();

    expect($reponse->json('request_id'))->toBe($reponse->headers->get('X-Request-Id'));
});
