<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Models\ListingFavorite;
use Tests\Feature\Listings\MarketplaceContext as M;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    M::semer();
    $this->org = C::organisation();
    $this->annonce = M::annonce($this->org);
    $this->moi = M::voyageur();
    $this->url = "/api/v1/marketplace/favorites/{$this->annonce->public_ref}";
});

it('exige un compte connecté et un e-mail vérifié', function (): void {
    $this->getJson('/api/v1/marketplace/favorites')->assertUnauthorized();
    $this->putJson($this->url)->assertUnauthorized();
    $this->deleteJson($this->url)->assertUnauthorized();
    $this->getJson($this->url)->assertUnauthorized();

    $this->actingAs(User::factory()->unverified()->create());
    foreach ([['get', '/api/v1/marketplace/favorites'], ['put', $this->url], ['delete', $this->url], ['get', $this->url]] as [$methode, $url]) {
        $this->json($methode, $url)->assertForbidden()->assertJsonPath('code', 'email_unverified');
    }
});

it('ajoute, lit, liste et retire un favori', function (): void {
    $this->actingAs($this->moi);

    $this->getJson($this->url)->assertNotFound();
    $this->putJson($this->url)->assertNoContent();
    $this->getJson($this->url)->assertOk()->assertJsonPath('data.ref', $this->annonce->public_ref);
    $this->getJson('/api/v1/marketplace/favorites')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.ref', $this->annonce->public_ref);

    $this->deleteJson($this->url)->assertNoContent();
    $this->getJson($this->url)->assertNotFound();
    $this->getJson('/api/v1/marketplace/favorites')->assertOk()->assertJsonCount(0, 'data');
});

it('est idempotent : deux ajouts, une seule ligne ; retirer un favori absent répond 204', function (): void {
    $this->actingAs($this->moi);

    $this->putJson($this->url)->assertNoContent();
    $this->putJson($this->url)->assertNoContent();
    expect(ListingFavorite::query()->where('user_id', $this->moi->id)->count())->toBe(1);

    $this->deleteJson($this->url)->assertNoContent();
    $this->deleteJson($this->url)->assertNoContent();
});

it('ne mélange jamais les favoris de deux comptes', function (): void {
    $autre = M::voyageur();
    $this->actingAs($autre)->putJson($this->url)->assertNoContent();

    $this->actingAs($this->moi);
    $this->getJson($this->url)->assertNotFound();
    $this->getJson('/api/v1/marketplace/favorites')->assertOk()->assertJsonCount(0, 'data');
    $this->deleteJson($this->url)->assertNoContent();

    expect(ListingFavorite::query()->where('user_id', $autre->id)->count())->toBe(1);
    $this->actingAs($autre)->getJson($this->url)->assertOk();
});

it('refuse de mettre en favori une annonce non publiée ou inconnue, et masque celle qui se dépublie', function (): void {
    $this->actingAs($this->moi);
    $brouillon = M::annonce($this->org, [], ListingStatus::Draft);

    $this->putJson("/api/v1/marketplace/favorites/{$brouillon->public_ref}")->assertNotFound();
    $this->putJson('/api/v1/marketplace/favorites/'.$brouillon->id)->assertNotFound();

    $this->putJson($this->url)->assertNoContent();
    C::dans($this->org, fn () => $this->annonce->forceFill(['status' => ListingStatus::Archived])->save());

    $this->getJson('/api/v1/marketplace/favorites')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson($this->url)->assertNotFound();
    $this->deleteJson($this->url)->assertNoContent();
    expect(ListingFavorite::query()->where('user_id', $this->moi->id)->count())->toBe(0);
});

it('pagine les favoris par curseur', function (): void {
    $this->actingAs($this->moi);
    $refs = [];
    foreach (range(1, 3) as $_) {
        $a = M::annonce($this->org);
        $refs[] = $a->public_ref;
        $this->putJson("/api/v1/marketplace/favorites/{$a->public_ref}")->assertNoContent();
    }

    $p1 = $this->getJson('/api/v1/marketplace/favorites?per_page=2')->assertOk();
    $p2 = $this->getJson('/api/v1/marketplace/favorites?per_page=2&cursor='.$p1->json('meta.next_cursor'))->assertOk();

    expect([...$p1->json('data.*.ref'), ...$p2->json('data.*.ref')])->toBe(array_reverse($refs));
    $this->getJson('/api/v1/marketplace/favorites?cursor=zzz')->assertUnprocessable();
});
