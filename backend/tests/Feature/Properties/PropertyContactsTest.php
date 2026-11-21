<?php

declare(strict_types=1);

use App\Modules\Catalog\Models\Term;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\PropertyContact;
use App\Shared\Audit\AuditLog;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->site = C::site($this->org);
    $this->lot = C::lot($this->org, $this->site);
    $this->partie = C::partie($this->org, ['display_name' => 'Plomberie Rapide', 'kind' => 'company', 'company_name' => 'Plomberie Rapide', 'last_name' => null, 'first_name' => null]);
    $this->url = C::url($this->org, "/properties/{$this->site->id}/contacts");
    $this->actingAs($this->titulaire);
});

function lienDeContact(array $corps = []): array
{
    return ['party_id' => test()->partie->id, ...$corps];
}

it('exige un jeton, la bonne organisation et, pour écrire, owner, admin ou manager', function (): void {
    $lien = $this->postJson($this->url, lienDeContact())->assertCreated()->json('data.id');
    $routes = [['post', $this->url, lienDeContact(['unit_id' => $this->lot->id])], ['delete', "{$this->url}/{$lien}", []]];
    $lectures = [$this->url, C::url($this->org, "/property-contacts?party={$this->partie->id}")];

    auth()->forgetGuards();
    foreach ($lectures as $url) {
        $this->getJson($url)->assertUnauthorized();
    }
    foreach ($routes as [$methode, $url, $corps]) {
        $this->json($methode, $url, $corps)->assertUnauthorized();
    }

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Accountant));
    foreach ($lectures as $url) {
        $this->getJson($url)->assertOk();
    }
    foreach ($routes as [$methode, $url, $corps]) {
        $this->json($methode, $url, $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    }

    C::changerDeCompte($this, C::titulaire(C::organisation()));
    foreach ($lectures as $url) {
        $this->getJson($url)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }
    foreach ($routes as [$methode, $url, $corps]) {
        $this->json($methode, $url, $corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Manager));
    $this->postJson($this->url, lienDeContact(['unit_id' => $this->lot->id]))->assertCreated();
    $this->deleteJson("{$this->url}/{$lien}")->assertNoContent();
});

it('rattache un contact à un site et à un lot avec sa catégorie, puis le relit des deux côtés', function (): void {
    $artisan = C::terme('contact_category', 'craftsman');

    $site = $this->postJson($this->url, lienDeContact(['contact_category_id' => $artisan->id]))->assertCreated()
        ->assertJsonPath('data.party.display_name', 'Plomberie Rapide')->assertJsonPath('data.category.semantic_key', 'craftsman')->assertJsonPath('data.unit_id', null)->assertJsonPath('data.unit_reference', null);
    $lot = $this->postJson($this->url, lienDeContact(['unit_id' => $this->lot->id]))->assertCreated()->assertJsonPath('data.unit_id', $this->lot->id)->assertJsonPath('data.unit_reference', $this->lot->reference)->assertJsonPath('data.category', null);

    $liste = $this->getJson($this->url)->assertOk();
    expect(array_column($liste->json('data'), 'id'))->toBe([$site->json('data.id'), $lot->json('data.id')]);
    $this->getJson("{$this->url}?unit={$this->lot->id}")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $lot->json('data.id'));

    $parContact = $this->getJson(C::url($this->org, "/property-contacts?party={$this->partie->id}"))->assertOk();
    expect($parContact->json('data'))->toHaveCount(2)->and($parContact->json('data.0.property_name'))->toBe($this->site->name)
        ->and($parContact->json('data.0.unit_reference'))->toBeNull()->and($parContact->json('data.1.unit_reference'))->toBe($this->lot->reference)
        ->and($this->getJson($this->url)->json('data.1.unit_reference'))->toBe($this->lot->reference)
        ->and($parContact->json('meta'))->toHaveKeys(['has_more', 'next_cursor']);
});

it('refuse un doublon de lien, mais admet le même contact sur le site et sur un lot', function (): void {
    $this->postJson($this->url, lienDeContact())->assertCreated();
    $this->postJson($this->url, lienDeContact())->assertStatus(409)->assertJsonPath('code', 'property_contact_exists');
    $this->postJson($this->url, lienDeContact(['unit_id' => $this->lot->id]))->assertCreated();
    $this->postJson($this->url, lienDeContact(['unit_id' => $this->lot->id]))->assertStatus(409)->assertJsonPath('code', 'property_contact_exists');
    expect(PropertyContact::query()->count())->toBe(2);
});

it('le doublon est aussi refusé par la base, y compris pour un lien sans lot', function (): void {
    $this->postJson($this->url, lienDeContact())->assertCreated();

    expect(fn () => DB::table('property_contacts')->insert([
        'id' => (string) Str::uuid7(), 'organization_id' => $this->org->id, 'property_id' => $this->site->id, 'unit_id' => null,
        'party_id' => $this->partie->id, 'created_at' => now(), 'updated_at' => now(),
    ]))->toThrow(UniqueConstraintViolationException::class);
});

it('lien vers un site, un lot, un contact ou une catégorie d\'une autre organisation : 404, rien écrit', function (): void {
    $autre = C::organisation();
    $siteEtranger = C::site($autre);
    $lotEtranger = C::lot($autre, $siteEtranger);
    $partieEtrangere = C::partie($autre);
    $termeEtranger = Term::factory()->create(['organization_id' => $autre->id, 'vocabulary' => 'contact_category', 'key' => 'privee']);

    $this->postJson(C::url($this->org, "/properties/{$siteEtranger->id}/contacts"), lienDeContact())->assertNotFound()->assertJsonPath('code', 'property_not_found');
    $this->postJson($this->url, lienDeContact(['unit_id' => $lotEtranger->id]))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    $this->postJson($this->url, ['party_id' => $partieEtrangere->id])->assertNotFound()->assertJsonPath('code', 'party_not_found');
    $this->postJson($this->url, lienDeContact(['contact_category_id' => $termeEtranger->id]))->assertNotFound()->assertJsonPath('code', 'term_not_found');
    $this->getJson(C::url($this->org, "/properties/{$siteEtranger->id}/contacts"))->assertNotFound()->assertJsonPath('code', 'property_not_found');
    $this->getJson(C::url($this->org, "/property-contacts?party={$partieEtrangere->id}"))->assertNotFound()->assertJsonPath('code', 'party_not_found');

    expect(PropertyContact::query()->withoutGlobalScopes()->count())->toBe(0);
});

it('un lot d\'un autre site de la même organisation est refusé', function (): void {
    $autreSite = C::site($this->org);
    $lotAutreSite = C::lot($this->org, $autreSite);

    $this->postJson($this->url, lienDeContact(['unit_id' => $lotAutreSite->id]))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
});

it('un contact anonymisé ne se rattache plus', function (): void {
    $this->partie->forceFill(['anonymized_at' => now()])->save();

    $this->postJson($this->url, lienDeContact())->assertStatus(409)->assertJsonPath('code', 'property_contact_party_anonymized');
});

it('retire le lien seulement, le journalise, et le lien d\'un autre site ou organisation reste introuvable', function (): void {
    $lien = $this->postJson($this->url, lienDeContact())->assertCreated()->json('data.id');
    $autreSite = C::site($this->org);

    $this->deleteJson(C::url($this->org, "/properties/{$autreSite->id}/contacts/{$lien}"))->assertNotFound()->assertJsonPath('code', 'property_contact_not_found');
    $this->deleteJson("{$this->url}/".Str::uuid7())->assertNotFound()->assertJsonPath('code', 'property_contact_not_found');
    expect(PropertyContact::query()->count())->toBe(1);

    $this->deleteJson("{$this->url}/{$lien}")->assertNoContent();

    expect(PropertyContact::query()->count())->toBe(0)
        ->and(AuditLog::query()->where('subject_id', $lien)->orderBy('occurred_at')->pluck('action')->all())->toBe(['property_contact.created', 'property_contact.deleted'])
        ->and(C::dans($this->org, fn () => Party::query()->whereKey($this->partie->id)->exists()))->toBeTrue();
});

it('valide la forme des paramètres', function (): void {
    $this->postJson($this->url, [])->assertUnprocessable()->assertJsonValidationErrors('party_id');
    $this->postJson($this->url, ['party_id' => 'x'])->assertUnprocessable()->assertJsonValidationErrors('party_id');
    $this->getJson(C::url($this->org, '/property-contacts'))->assertUnprocessable()->assertJsonValidationErrors('party');
    $this->getJson("{$this->url}?cursor=n-importe-quoi")->assertUnprocessable();
    $this->getJson(C::url($this->org, '/properties/pas-un-uuid/contacts'))->assertNotFound();
});

it('pagine par curseur et garde un nombre de requêtes constant', function (): void {
    $mesures = [];

    foreach ([1, 10, 30] as $total) {
        foreach (range(C::dans($this->org, fn (): int => PropertyContact::query()->count()) + 1, $total) as $_) {
            $partie = C::partie($this->org);
            $this->postJson($this->url, ['party_id' => $partie->id, 'contact_category_id' => C::terme('contact_category', 'craftsman')->id])->assertCreated();
        }

        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->getJson("{$this->url}?per_page=100")->assertOk()->assertJsonCount($total, 'data');
        $mesures[$total] = count(DB::getQueryLog());
        DB::disableQueryLog();
    }

    expect($mesures[10])->toBe($mesures[1])->and($mesures[30])->toBe($mesures[1]);

    $premiere = $this->getJson("{$this->url}?per_page=10")->assertOk();
    $vus = array_column($premiere->json('data'), 'id');
    $curseur = $premiere->json('meta.next_cursor');

    while ($curseur !== null) {
        $page = $this->getJson("{$this->url}?per_page=10&cursor=".urlencode($curseur))->assertOk();
        $vus = [...$vus, ...array_column($page->json('data'), 'id')];
        $curseur = $page->json('meta.next_cursor');
    }

    expect($vus)->toHaveCount(30)->and(array_unique($vus))->toHaveCount(30);
});
