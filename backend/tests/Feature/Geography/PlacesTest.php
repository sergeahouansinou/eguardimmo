<?php

declare(strict_types=1);

use App\Modules\Geography\Models\City;
use App\Modules\Geography\PublicApi\CityDirectory;
use App\Modules\Geography\PublicApi\GeographyCatalog;
use Tests\Feature\Listings\MarketplaceContext as M;

beforeEach(function (): void {
    M::semer();
});

it('cherche une commune par préfixe de nom, sans compte', function (): void {
    $reponse = $this->getJson('/api/v1/marketplace/places?q=Lyo')->assertOk();

    expect($reponse->json('data'))->toBe([['slug' => 'lyon', 'name' => 'Lyon', 'postal_code' => '69001', 'country' => 'FR']]);
});

it('cherche par préfixe de code postal et ne renvoie ni identifiant ni coordonnée', function (): void {
    $reponse = $this->getJson('/api/v1/marketplace/places?q=13')->assertOk();

    expect(collect($reponse->json('data'))->pluck('slug')->all())->toContain('marseille', 'aix-en-provence')
        ->and($reponse->getContent())->not->toContain('latitude')->not->toContain('longitude')->not->toContain('"id"');
});

it('ne fait pas de recherche par milieu de mot', function (): void {
    $this->getJson('/api/v1/marketplace/places?q=yon')->assertOk()->assertJsonCount(0, 'data');
});

it('neutralise les jokers de LIKE saisis par le client', function (): void {
    $this->getJson('/api/v1/marketplace/places?q='.urlencode('%%'))->assertOk()->assertJsonCount(0, 'data');
    $this->getJson('/api/v1/marketplace/places?q='.urlencode('L_on'))->assertOk()->assertJsonCount(0, 'data');
});

it('limite à 10 résultats', function (): void {
    foreach (range(1, 14) as $n) {
        City::factory()->create(['name' => 'Tourville '.$n, 'slug' => 'tourville-'.$n]);
    }

    $this->getJson('/api/v1/marketplace/places?q=Tourv')->assertOk()->assertJsonCount(10, 'data');
});

it('exige entre 2 et 80 caractères', function (): void {
    $this->getJson('/api/v1/marketplace/places?q=L')->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
    $this->getJson('/api/v1/marketplace/places')->assertUnprocessable();
    $this->getJson('/api/v1/marketplace/places?q='.str_repeat('a', 81))->assertUnprocessable();
    $this->getJson('/api/v1/marketplace/places?q='.str_repeat('a', 80))->assertOk();
});

it('limite le débit par adresse IP', function (): void {
    foreach (range(1, 30) as $_) {
        $this->getJson('/api/v1/marketplace/places?q=Lyon')->assertOk();
    }

    $this->getJson('/api/v1/marketplace/places?q=Lyon')->assertTooManyRequests()->assertJsonPath('code', 'too_many_requests');
});

it('alimente le référentiel sans doublon quand le seeder est rejoué', function (): void {
    $avant = City::query()->count();
    app(GeographyCatalog::class)->seed();

    expect($avant)->toBeGreaterThan(20)->and(City::query()->count())->toBe($avant);
});

it('expose les communes aux autres modules par la PublicApi', function (): void {
    $lyon = M::ville('lyon');
    $annuaire = app(CityDirectory::class);

    expect($annuaire->find($lyon->id)?->slug)->toBe('lyon')
        ->and($annuaire->findBySlug('lyon')?->id)->toBe($lyon->id)
        ->and($annuaire->findBySlug('inconnue'))->toBeNull()
        ->and(array_keys($annuaire->findMany([$lyon->id, 'inconnu'])))->toBe([$lyon->id]);
});
