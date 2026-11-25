<?php

declare(strict_types=1);

use App\Modules\Listings\Enums\ListingStatus;
use Illuminate\Support\Carbon;
use Tests\Feature\Listings\MarketplaceContext as M;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    M::semer();
    $this->org = C::organisation();
});

it('sert la fiche publique d\'une annonce publiée, sans compte, sans adresse ni identifiant', function (): void {
    $annonce = M::annonce($this->org, ['title' => 'Loft des Pentes', 'neighbourhood' => 'Croix-Rousse', 'deposit_minor' => 30000]);

    $reponse = $this->getJson("/api/v1/marketplace/listings/{$annonce->public_ref}")->assertOk();
    $data = $reponse->json('data');

    expect($data['ref'])->toBe($annonce->public_ref)
        ->and($data['title'])->toBe('Loft des Pentes')
        ->and($data['city'])->toBe(['slug' => 'lyon', 'name' => 'Lyon', 'postal_code' => '69001'])
        ->and($data['neighbourhood'])->toBe('Croix-Rousse')
        ->and($data['price'])->toBe(['amount' => 9000, 'currency' => 'EUR'])
        ->and($data['deposit'])->toBe(['amount' => 30000, 'currency' => 'EUR'])
        ->and($data['host'])->toBe(['name' => 'Agence du Port'])
        ->and($data['cancellation_policy'])->toBe('moderate');

    $corps = $reponse->getContent();
    foreach ([$annonce->id, $annonce->organization_id, 'organization', 'unit_id', 'latitude', 'longitude', 'address', 'lock_version', 'status'] as $interdit) {
        expect($corps)->not->toContain((string) $interdit);
    }
});

it('répond 404 pour un brouillon, une annonce archivée, une référence inconnue ou mal formée', function (): void {
    $brouillon = M::annonce($this->org, [], ListingStatus::Draft);
    $archivee = M::annonce($this->org, [], ListingStatus::Archived);

    foreach ([$brouillon->public_ref, $archivee->public_ref, 'abcdefghjkmn'] as $ref) {
        $this->getJson("/api/v1/marketplace/listings/{$ref}")->assertNotFound();
    }

    $this->getJson('/api/v1/marketplace/listings/'.$brouillon->id)->assertNotFound();
});

it('ne liste que les annonces publiées, toutes organisations confondues', function (): void {
    $autre = C::organisation();
    $a = M::annonce($this->org);
    $b = M::annonce($autre);
    M::annonce($this->org, [], ListingStatus::Draft);
    M::annonce($autre, [], ListingStatus::Archived);

    $refs = collect($this->getJson('/api/v1/marketplace/listings')->assertOk()->json('data'))->pluck('ref')->sort()->values()->all();

    expect($refs)->toBe(collect([$a->public_ref, $b->public_ref])->sort()->values()->all());
});

it('filtre par lieu, type, catégorie, voyageurs, prix et équipements', function (): void {
    $lyon = M::annonce($this->org, ['title' => 'Lyon wifi', 'amenities' => ['wifi', 'pool'], 'price_minor' => 5000, 'capacity' => 2, 'category' => 'studio']);
    $nice = M::annonce($this->org, ['title' => 'Nice', 'city_id' => M::ville('nice')->id, 'amenities' => ['wifi'], 'price_minor' => 12000, 'capacity' => 6, 'category' => 'house']);
    $long = M::annonce($this->org, ['title' => 'Long', 'kind' => 'long_term', 'price_unit' => 'month', 'price_minor' => 90000, 'capacity' => 3]);
    $titres = fn (string $requete): array => collect($this->getJson("/api/v1/marketplace/listings?{$requete}")->assertOk()->json('data'))->pluck('title')->sort()->values()->all();

    expect($titres('place=nice'))->toBe(['Nice'])
        ->and($titres('place=inconnue'))->toBe([])
        ->and($titres('kind=long_term'))->toBe(['Long'])
        ->and($titres('category=studio'))->toBe(['Lyon wifi'])
        ->and($titres('guests=5'))->toBe(['Nice'])
        ->and($titres('min_price=6000&max_price=20000'))->toBe(['Nice'])
        ->and($titres('amenities[]=wifi&amenities[]=pool'))->toBe(['Lyon wifi'])
        ->and($titres('amenities[]=wifi&kind=short_stay'))->toBe(['Lyon wifi', 'Nice']);

    expect([$lyon->id, $nice->id, $long->id])->each->toBeString();
});

it('refuse les filtres invalides', function (string $requete): void {
    $this->getJson("/api/v1/marketplace/listings?{$requete}")->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
})->with([
    'tri inconnu' => 'sort=hasard',
    'type inconnu' => 'kind=castle',
    'équipement hors liste' => 'amenities[]=jacuzzi',
    'plafond sous le plancher' => 'min_price=500&max_price=100',
    'page trop grande' => 'per_page=25',
    'curseur invalide' => 'after=zzz',
    'lieu avec jokers' => 'place=ly%25on',
    'voyageurs à zéro' => 'guests=0',
]);

it('trie par prix croissant, décroissant ou par récence, et pagine par curseur sans trou ni doublon', function (string $tri, array $attendu): void {
    Carbon::setTestNow('2026-11-21 10:00:00');
    foreach ([[7000, 'A'], [3000, 'B'], [3000, 'C'], [9000, 'D'], [5000, 'E']] as $i => [$prix, $titre]) {
        Carbon::setTestNow(Carbon::parse('2026-11-21 10:00:00')->addMinutes($i));
        M::annonce($this->org, ['title' => $titre, 'price_minor' => $prix]);
    }

    $titres = [];
    $curseur = null;
    do {
        $page = $this->getJson("/api/v1/marketplace/listings?sort={$tri}&per_page=2".($curseur === null ? '' : "&after={$curseur}"))->assertOk();
        array_push($titres, ...$page->json('data.*.title'));
        $curseur = $page->json('meta.next_cursor');
        expect($page->json('meta.has_more'))->toBe($curseur !== null);
    } while ($curseur !== null);

    expect($titres)->toBe($attendu);
})->with([
    'récent' => ['recent', ['E', 'D', 'C', 'B', 'A']],
    'pertinence' => ['relevance', ['E', 'D', 'C', 'B', 'A']],
    'prix croissant' => ['price_asc', ['B', 'C', 'E', 'A', 'D']],
    'prix décroissant' => ['price_desc', ['D', 'A', 'E', 'C', 'B']],
]);

it('refuse un curseur issu d\'un autre tri', function (): void {
    foreach (range(1, 3) as $n) {
        M::annonce($this->org, ['title' => "N{$n}", 'price_minor' => 1000 * $n]);
    }

    $curseur = $this->getJson('/api/v1/marketplace/listings?sort=recent&per_page=1')->assertOk()->json('meta.next_cursor');

    $this->getJson("/api/v1/marketplace/listings?sort=price_asc&per_page=1&after={$curseur}")->assertUnprocessable();
});

it('plafonne la page à 24 annonces et limite le débit par IP', function (): void {
    $this->getJson('/api/v1/marketplace/listings?per_page=24')->assertOk();

    foreach (range(1, 59) as $_) {
        $this->getJson('/api/v1/marketplace/listings')->assertOk();
    }

    $this->getJson('/api/v1/marketplace/listings')->assertTooManyRequests();
});

it('affiche le nom de l\'organisation et rien d\'autre sur elle', function (): void {
    M::annonce($this->org);

    $carte = $this->getJson('/api/v1/marketplace/listings')->assertOk()->json('data.0');

    expect(array_keys($carte['host']))->toBe(['name'])->and(array_keys($carte))->not->toContain('id', 'organization_id', 'status', 'unit_id');
});
