<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Catalog\Models\Tag;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Models\UnitOwnership;
use Illuminate\Database\Eloquent\Relations\Relation;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
});

/**
 * @param  array<string, mixed>  $surcharges
 * @return array<string, mixed>
 */
function propertiesSite(array $surcharges = []): array
{
    return [
        'name' => 'Résidence du Port',
        'type' => 'building',
        'address' => ['line1' => '12 rue du Port', 'line2' => 'Bâtiment A', 'postal_code' => '13002', 'city' => 'Marseille', 'country' => 'FR'],
        ...$surcharges,
    ];
}

it('exige un jeton, un rôle suffisant et la bonne organisation sur chaque route des sites', function (): void {
    $site = C::site($this->org);
    $lectures = ['/properties', "/properties/{$site->id}"];
    $routes = [
        ['post', '/properties', propertiesSite()],
        ['patch', "/properties/{$site->id}", ['lock_version' => 1]],
        ['post', "/properties/{$site->id}/archive", []],
        ['delete', "/properties/{$site->id}/archive", []],
    ];

    foreach ($lectures as $chemin) {
        $this->getJson(C::url($this->org, $chemin))->assertUnauthorized();
    }

    foreach ($routes as [$methode, $chemin, $corps]) {
        $this->json($methode, C::url($this->org, $chemin), $corps)->assertUnauthorized();
    }

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Accountant));

    foreach ($lectures as $chemin) {
        $this->getJson(C::url($this->org, $chemin))->assertOk();
    }

    foreach ($routes as [$methode, $chemin, $corps]) {
        $this->json($methode, C::url($this->org, $chemin), $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    }

    C::changerDeCompte($this, C::titulaire(C::organisation()));

    foreach ($lectures as $chemin) {
        $this->getJson(C::url($this->org, $chemin))->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }

    foreach ($routes as [$methode, $chemin, $corps]) {
        $this->json($methode, C::url($this->org, $chemin), $corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }
});

it('autorise l\'écriture au gestionnaire et à l\'administrateur', function (): void {
    foreach ([MemberRole::Manager, MemberRole::Admin] as $role) {
        C::changerDeCompte($this, C::membre($this->org, $role))->postJson(C::url($this->org, '/properties'), propertiesSite())->assertCreated();
    }
});

it('refuse le site d\'une autre organisation par property_not_found', function (): void {
    $autre = C::organisation();
    $site = C::site($autre);
    $this->actingAs($this->titulaire);

    $this->getJson(C::url($this->org, "/properties/{$site->id}"))->assertNotFound()->assertJsonPath('code', 'property_not_found');
    $this->patchJson(C::url($this->org, "/properties/{$site->id}"), ['lock_version' => 1, 'name' => 'Pirate'])->assertNotFound()->assertJsonPath('code', 'property_not_found');
    $this->postJson(C::url($this->org, "/properties/{$site->id}/archive"))->assertNotFound()->assertJsonPath('code', 'property_not_found');
    $this->getJson(C::url($this->org, '/properties/pas-un-uuid'))->assertNotFound();
    expect(C::dans($autre, fn () => Property::query()->findOrFail($site->id)->name))->toBe($site->name);
});

it('crée un site avec champ personnalisé et étiquette, puis le relit', function (): void {
    C::dans($this->org, fn () => CustomFieldDefinition::factory()->create(['entity' => CustomFieldEntity::Property, 'key' => 'code_portail', 'type' => CustomFieldType::Text]));
    $etiquette = C::dans($this->org, fn (): Tag => Tag::factory()->create(['name' => 'Copropriété', 'slug' => 'copropriete']));

    $this->actingAs($this->titulaire);
    $id = $this->postJson(C::url($this->org, '/properties'), propertiesSite(['custom_fields' => ['code_portail' => 'A1234'], 'tag_ids' => [$etiquette->id]]))
        ->assertCreated()
        ->assertJsonPath('data.name', 'Résidence du Port')
        ->assertJsonPath('data.type', 'building')
        ->assertJsonPath('data.address.city', 'Marseille')
        ->assertJsonPath('data.address.line2', 'Bâtiment A')
        ->assertJsonPath('data.custom_fields.code_portail', 'A1234')
        ->assertJsonPath('data.tags.0.slug', 'copropriete')
        ->assertJsonPath('data.lock_version', 1)
        ->assertJsonPath('data.active_units_count', 0)
        ->assertJsonPath('data.archived_at', null)
        ->json('data.id');

    $this->getJson(C::url($this->org, "/properties/{$id}"))->assertOk()->assertJsonPath('data.name', 'Résidence du Port');
    expect(C::dans($this->org, fn () => Property::query()->findOrFail($id)->organization_id))->toBe($this->org->id);
});

it('valide le site en liste blanche et ignore organization_id', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/properties');

    $this->postJson($url, propertiesSite(['type' => 'chateau']))->assertUnprocessable()->assertJsonValidationErrors('type');
    $this->postJson($url, propertiesSite(['name' => '']))->assertUnprocessable()->assertJsonValidationErrors('name');
    $this->postJson($url, propertiesSite(['address' => null]))->assertUnprocessable()->assertJsonValidationErrors('address');
    $this->postJson($url, propertiesSite(['address' => ['line1' => '1 rue', 'postal_code' => '1', 'city' => 'Lyon', 'country' => 'fr']]))->assertUnprocessable()->assertJsonValidationErrors('address.country');
    $this->postJson($url, propertiesSite(['address' => ['line1' => '1 rue', 'postal_code' => '1', 'city' => 'Lyon', 'country' => 'FR', 'region' => 'x']]))->assertUnprocessable()->assertJsonValidationErrors('address');
    $this->postJson($url, propertiesSite(['custom_fields' => ['inconnu' => 'x']]))->assertUnprocessable();

    $autre = C::organisation();
    $id = $this->postJson($url, propertiesSite(['organization_id' => $autre->id]))->assertCreated()->json('data.id');
    expect(C::dans($this->org, fn () => Property::query()->findOrFail($id)->organization_id))->toBe($this->org->id);
});

it('modifie un site avec son numéro de version et répond 409 quand il est périmé', function (): void {
    $site = C::site($this->org);
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, "/properties/{$site->id}");

    $this->patchJson($url, ['lock_version' => 1, 'name' => 'Résidence Neuve', 'address' => propertiesSite()['address']])
        ->assertOk()
        ->assertJsonPath('data.name', 'Résidence Neuve')
        ->assertJsonPath('data.address.line2', 'Bâtiment A')
        ->assertJsonPath('data.lock_version', 2);

    $this->patchJson($url, ['lock_version' => 1, 'name' => 'Périmé'])->assertConflict()->assertJsonPath('code', 'property_version_conflict');
    $this->patchJson($url, ['name' => 'Sans version'])->assertUnprocessable()->assertJsonValidationErrors('lock_version');
    expect(C::dans($this->org, fn () => Property::query()->findOrFail($site->id)->name))->toBe('Résidence Neuve');
});

it('archive un site sans lot actif, le masque de la liste et le restaure', function (): void {
    $site = C::site($this->org);
    $lot = C::lot($this->org, $site);
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, "/properties/{$site->id}/archive");

    $this->postJson($url)->assertConflict()->assertJsonPath('code', 'property_has_active_units');

    $this->postJson(C::url($this->org, "/units/{$lot->id}/archive"))->assertOk();
    $this->postJson($url)->assertOk()->assertJsonPath('data.archived_at', fn (?string $date): bool => $date !== null);

    expect($this->getJson(C::url($this->org, '/properties'))->json('data'))->toBe([])
        ->and($this->getJson(C::url($this->org, '/properties?status=archived'))->json('data.0.id'))->toBe($site->id);

    $this->deleteJson($url)->assertOk()->assertJsonPath('data.archived_at', null);
    expect($this->getJson(C::url($this->org, '/properties'))->json('data.0.id'))->toBe($site->id)
        ->and(C::dans($this->org, fn () => Property::query()->whereKey($site->id)->exists()))->toBeTrue();
});

it('liste par curseur avec recherche, type et statut, sans les sites des autres organisations', function (): void {
    foreach (['Alpha', 'Bravo', 'Charlie'] as $nom) {
        C::site($this->org, ['name' => $nom]);
    }
    C::site($this->org, ['name' => 'Villa des Pins', 'type' => 'house', 'address' => ['line1' => '3 allée des Pins', 'postal_code' => '83990', 'city' => 'Saint-Tropez', 'country' => 'FR']]);
    C::site(C::organisation(), ['name' => 'Alpha voisin']);
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/properties');

    $page = $this->getJson("{$url}?per_page=2")->assertOk();
    $suivante = $this->getJson("{$url}?per_page=2&cursor=".$page->json('meta.next_cursor'))->assertOk();

    expect(array_column($page->json('data'), 'name'))->toBe(['Alpha', 'Bravo'])
        ->and(array_column($suivante->json('data'), 'name'))->toBe(['Charlie', 'Villa des Pins'])
        ->and(array_column($this->getJson("{$url}?q=tropez")->json('data'), 'name'))->toBe(['Villa des Pins'])
        ->and(array_column($this->getJson("{$url}?q=83990")->json('data'), 'name'))->toBe(['Villa des Pins'])
        ->and(array_column($this->getJson("{$url}?q=brav")->json('data'), 'name'))->toBe(['Bravo'])
        ->and(array_column($this->getJson("{$url}?type=house")->json('data'), 'name'))->toBe(['Villa des Pins'])
        ->and($this->getJson("{$url}?q=%25")->json('data'))->toBe([]);

    $this->getJson("{$url}?cursor=n-importe-quoi")->assertUnprocessable();
    $this->getJson("{$url}?type=chateau")->assertUnprocessable();
});

it('déclare les types d\'objets de la morph map', function (): void {
    expect(Relation::getMorphedModel('property'))->toBe(Property::class)
        ->and(Relation::getMorphedModel('unit'))->toBe(Unit::class)
        ->and(Relation::getMorphedModel('unit_ownership'))->toBe(UnitOwnership::class);
});
