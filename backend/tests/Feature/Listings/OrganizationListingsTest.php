<?php

declare(strict_types=1);

use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\Listing;
use App\Modules\Organizations\Enums\MemberRole;
use Tests\Feature\Listings\MarketplaceContext as M;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    M::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->actingAs($this->titulaire);
});

function creerAnnonceApi(array $corps = []): array
{
    return test()->postJson(M::url(test()->org), M::corpsAnnonce($corps))->assertCreated()->json('data');
}

it('crée un brouillon complet dans l\'organisation courante, avec une référence publique opaque', function (): void {
    $annonce = creerAnnonceApi();

    expect($annonce['status'])->toBe('draft')
        ->and($annonce['public_ref'])->toMatch('/^[a-z2-9]{12}$/')
        ->and($annonce['public_ref'])->not->toBe($annonce['id'])
        ->and($annonce['price'])->toBe(['amount' => 8500, 'currency' => 'EUR'])
        ->and($annonce['price_unit'])->toBe('night')
        ->and($annonce['amenities'])->toBe(['wifi', 'kitchen'])
        ->and($annonce['lock_version'])->toBe(1)
        ->and($annonce['missing_for_publication'])->toBe([]);

    $enBase = C::dans($this->org, fn (): Listing => Listing::query()->findOrFail($annonce['id']));
    expect($enBase->organization_id)->toBe($this->org->id)->and($enBase->published_at)->toBeNull();
});

it('accepte un brouillon minimal et indique ce qui manque pour publier', function (): void {
    $annonce = $this->postJson(M::url($this->org), ['kind' => 'long_term', 'category' => 'studio'])->assertCreated()->json('data');

    expect($annonce['price_unit'])->toBe('month')
        ->and($annonce['missing_for_publication'])->toBe(['title', 'price_minor', 'city_id', 'capacity']);
});

it('ignore organization_id, statut, référence et version envoyés par le client', function (): void {
    $autre = C::organisation();
    $annonce = creerAnnonceApi(['organization_id' => $autre->id, 'status' => 'published', 'public_ref' => 'aaaaaaaaaaaa', 'published_at' => '2020-01-01', 'lock_version' => 99, 'unit_id' => (string) fake()->uuid()]);

    $enBase = C::dans($this->org, fn (): Listing => Listing::query()->findOrFail($annonce['id']));
    expect($enBase->organization_id)->toBe($this->org->id)
        ->and($enBase->status)->toBe(ListingStatus::Draft)
        ->and($enBase->public_ref)->not->toBe('aaaaaaaaaaaa')
        ->and($enBase->published_at)->toBeNull()
        ->and($enBase->lock_version)->toBe(1)
        ->and($enBase->unit_id)->toBeNull();
});

it('refuse le HTML, les équipements hors liste blanche et les valeurs hors bornes', function (): void {
    foreach ([
        ['title' => 'Joli <b>studio</b>'],
        ['description' => '<script>alert(1)</script>'],
        ['neighbourhood' => 'Vaise >'],
        ['amenities' => ['wifi', 'jacuzzi']],
        ['amenities' => ['wifi', 'wifi']],
        ['price_minor' => 0],
        ['price_minor' => 'abc'],
        ['capacity' => 0],
        ['currency' => 'USD'],
        ['category' => 'castle'],
        ['cancellation_policy' => 'whenever'],
        ['title' => str_repeat('a', 121)],
        ['description' => str_repeat('a', 4001)],
        ['city_id' => 'pas-un-uuid'],
    ] as $corps) {
        $this->postJson(M::url($this->org), M::corpsAnnonce($corps))->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
    }

    $this->postJson(M::url($this->org), M::corpsAnnonce(['city_id' => (string) fake()->uuid()]))->assertUnprocessable()->assertJsonPath('code', 'listing_city_invalid');
});

it('modifie une annonce avec le contrôle de version et incrémente lock_version', function (): void {
    $annonce = creerAnnonceApi();
    $url = M::url($this->org, "/{$annonce['id']}");

    $this->patchJson($url, ['lock_version' => 1, 'title' => 'Nouveau titre', 'price_minor' => 9900])->assertOk()
        ->assertJsonPath('data.title', 'Nouveau titre')->assertJsonPath('data.price.amount', 9900)->assertJsonPath('data.lock_version', 2);

    $this->patchJson($url, ['lock_version' => 1, 'title' => 'Périmé'])->assertConflict()->assertJsonPath('code', 'listing_stale_version');
    $this->patchJson($url, ['title' => 'Sans version'])->assertUnprocessable();
    $this->patchJson($url, ['lock_version' => 2, 'kind' => 'long_term', 'status' => 'published'])->assertOk()
        ->assertJsonPath('data.kind', 'short_stay')->assertJsonPath('data.status', 'draft');
});

it('refuse de publier une annonce incomplète et dit ce qui manque', function (): void {
    $annonce = $this->postJson(M::url($this->org), ['kind' => 'short_stay', 'category' => 'studio', 'title' => 'Studio'])->assertCreated()->json('data');

    $this->postJson(M::url($this->org, "/{$annonce['id']}/publish"), ['lock_version' => 1])->assertUnprocessable()
        ->assertJsonPath('code', 'listing_incomplete')->assertJsonPath('missing', ['price_minor', 'city_id', 'capacity']);

    expect(C::dans($this->org, fn (): ListingStatus => Listing::query()->findOrFail($annonce['id'])->status))->toBe(ListingStatus::Draft);
});

it('refuse les caractères de contrôle et de format, et n\'admet que le saut de ligne dans la description', function (): void {
    foreach ([
        ['title' => "Studio\nlumineux"],
        ['title' => "Stu\rdio"],
        ['title' => "Stu\u{0000}dio"],
        ['title' => "Studio\u{202E}evitisop"],
        ['title' => "Studio\u{200B}vide"],
        ['neighbourhood' => "Vaise\u{0007}"],
        ['neighbourhood' => "Vaise\tCentre"],
        ['description' => "Ligne\r\nsuivante"],
        ['description' => "Texte\u{001B}[31m"],
        ['description' => "Texte\u{202E}inversé"],
        ['description' => "Texte\u{FEFF}suite"],
    ] as $corps) {
        $this->postJson(M::url($this->org), M::corpsAnnonce($corps))->assertUnprocessable()->assertJsonPath('code', 'validation_failed');
    }

    $this->postJson(M::url($this->org), M::corpsAnnonce(['title' => 'Café – Croix-Rousse', 'description' => "Premier paragraphe.\n\nSecond paragraphe, très calme."]))->assertCreated();
});

it('publie, rejoue la publication sans effet, archive, puis republie', function (): void {
    $annonce = creerAnnonceApi();
    $publier = M::url($this->org, "/{$annonce['id']}/publish");

    $publiee = $this->postJson($publier, ['lock_version' => 1])->assertOk()->assertJsonPath('data.status', 'published')->json('data');
    expect($publiee['published_at'])->not->toBeNull()->and($publiee['lock_version'])->toBe(2);

    $this->postJson($publier, ['lock_version' => 2])->assertOk()->assertJsonPath('data.lock_version', 2);
    $this->getJson("/api/v1/marketplace/listings/{$annonce['public_ref']}")->assertOk();

    $this->postJson(M::url($this->org, "/{$annonce['id']}/archive"), ['lock_version' => 2])->assertOk()->assertJsonPath('data.status', 'archived')->assertJsonPath('data.lock_version', 3);
    $this->getJson("/api/v1/marketplace/listings/{$annonce['public_ref']}")->assertNotFound();
    $this->patchJson(M::url($this->org, "/{$annonce['id']}"), ['lock_version' => 3, 'title' => 'X'])->assertConflict()->assertJsonPath('code', 'listing_archived');

    $this->postJson($publier, ['lock_version' => 3])->assertOk()->assertJsonPath('data.status', 'published')->assertJsonPath('data.lock_version', 4);
});

it('exige lock_version pour publier et archiver, et refuse une version périmée sans rien changer', function (): void {
    $annonce = creerAnnonceApi();
    $id = $annonce['id'];

    foreach (['publish', 'archive'] as $action) {
        $this->postJson(M::url($this->org, "/{$id}/{$action}"))->assertUnprocessable()->assertJsonValidationErrors('lock_version');
        $this->postJson(M::url($this->org, "/{$id}/{$action}"), ['lock_version' => 'x'])->assertUnprocessable()->assertJsonValidationErrors('lock_version');
    }

    $this->postJson(M::url($this->org, "/{$id}/publish"), ['lock_version' => 7])->assertConflict()->assertJsonPath('code', 'listing_stale_version');
    $this->postJson(M::url($this->org, "/{$id}/archive"), ['lock_version' => 7])->assertConflict()->assertJsonPath('code', 'listing_stale_version');

    $this->postJson(M::url($this->org, "/{$id}/publish"), ['lock_version' => 1])->assertOk();
    $this->postJson(M::url($this->org, "/{$id}/publish"), ['lock_version' => 1])->assertConflict()->assertJsonPath('code', 'listing_stale_version');
    $this->postJson(M::url($this->org, "/{$id}/archive"), ['lock_version' => 1])->assertConflict()->assertJsonPath('code', 'listing_stale_version');

    $enBase = C::dans($this->org, fn (): Listing => Listing::query()->findOrFail($id));
    expect($enBase->status)->toBe(ListingStatus::Published)->and($enBase->lock_version)->toBe(2);
});

it('ne laisse pas retirer le prix d\'une annonce publiée', function (): void {
    $annonce = creerAnnonceApi();
    $this->postJson(M::url($this->org, "/{$annonce['id']}/publish"), ['lock_version' => 1])->assertOk();

    $this->patchJson(M::url($this->org, "/{$annonce['id']}"), ['lock_version' => 2, 'price_minor' => null])->assertUnprocessable()
        ->assertJsonPath('code', 'listing_incomplete')->assertJsonPath('missing', ['price_minor']);
});

it('exige un jeton, un rôle owner, admin ou manager et la bonne organisation', function (): void {
    $annonce = creerAnnonceApi();
    $id = $annonce['id'];
    $appels = [
        ['get', M::url($this->org), []],
        ['post', M::url($this->org), M::corpsAnnonce()],
        ['get', M::url($this->org, "/{$id}"), []],
        ['patch', M::url($this->org, "/{$id}"), ['lock_version' => 1, 'title' => 'X']],
        ['post', M::url($this->org, "/{$id}/publish"), ['lock_version' => 1]],
        ['post', M::url($this->org, "/{$id}/archive"), ['lock_version' => 1]],
    ];

    auth()->forgetGuards();
    foreach ($appels as [$methode, $url, $corps]) {
        $this->json($methode, $url, $corps)->assertUnauthorized();
    }

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Accountant));
    foreach ($appels as [$methode, $url, $corps]) {
        $this->json($methode, $url, $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    }

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Manager));
    $this->getJson(M::url($this->org, "/{$id}"))->assertOk();

    C::changerDeCompte($this, C::titulaire(C::organisation()));
    foreach ($appels as [$methode, $url, $corps]) {
        $this->json($methode, $url, $corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }
});

it('cloisonne par organisation : l\'annonce d\'une autre organisation est introuvable', function (): void {
    $autre = C::organisation();
    $etrangere = M::annonce($autre);
    $maListe = creerAnnonceApi();

    $this->getJson(M::url($this->org, "/{$etrangere->id}"))->assertNotFound()->assertJsonPath('code', 'listing_not_found');
    $this->patchJson(M::url($this->org, "/{$etrangere->id}"), ['lock_version' => 1, 'title' => 'Piratée'])->assertNotFound();
    $this->postJson(M::url($this->org, "/{$etrangere->id}/publish"), ['lock_version' => 1])->assertNotFound();
    $this->postJson(M::url($this->org, "/{$etrangere->id}/archive"), ['lock_version' => 1])->assertNotFound();
    $this->getJson(M::url($this->org, '/'.fake()->uuid()))->assertNotFound();

    $ids = collect($this->getJson(M::url($this->org))->assertOk()->json('data'))->pluck('id')->all();
    expect($ids)->toBe([$maListe['id']])->and(C::dans($autre, fn (): string => (string) Listing::query()->findOrFail($etrangere->id)->title))->toBe('Appartement lumineux');
});

it('liste par curseur, du plus récent au plus ancien, avec filtre de statut', function (): void {
    $ids = array_map(fn (): string => creerAnnonceApi()['id'], range(1, 5));
    $this->postJson(M::url($this->org, "/{$ids[0]}/publish"), ['lock_version' => 1])->assertOk();

    $page1 = $this->getJson(M::url($this->org).'?per_page=2')->assertOk();
    $page2 = $this->getJson(M::url($this->org).'?per_page=2&cursor='.$page1->json('meta.next_cursor'))->assertOk();
    $page3 = $this->getJson(M::url($this->org).'?per_page=2&cursor='.$page2->json('meta.next_cursor'))->assertOk();
    $vus = [...$page1->json('data.*.id'), ...$page2->json('data.*.id'), ...$page3->json('data.*.id')];

    expect($vus)->toBe(array_reverse($ids))->and($page3->json('meta.has_more'))->toBeFalse();
    $this->getJson(M::url($this->org).'?status=published')->assertOk()->assertJsonCount(1, 'data');
    $this->getJson(M::url($this->org).'?status=nimporte')->assertUnprocessable();
    $this->getJson(M::url($this->org).'?cursor=zzz')->assertUnprocessable();
});
