<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Catalog\Models\Tag;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Properties\Models\Unit;
use Illuminate\Database\QueryException;
use Tests\Feature\Properties\PropertiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->site = C::site($this->org);
});

/**
 * @param  array<string, mixed>  $surcharges
 * @return array<string, mixed>
 */
function propertiesLot(object $test, array $surcharges = []): array
{
    return [
        'property_id' => $test->site->id,
        'unit_type_term_id' => C::terme('unit_type', 'apartment')->id,
        'reference' => 'A-101',
        'floor' => 1,
        'surface_hundredths' => 5250,
        ...$surcharges,
    ];
}

it('exige un jeton, un rôle suffisant et la bonne organisation sur chaque route des lots', function (): void {
    $lot = C::lot($this->org, $this->site);
    $partie = C::partie($this->org);
    $inconnu = fake()->uuid();
    $lectures = ['/units', "/units/{$lot->id}", "/units/{$lot->id}/annexes", "/units/{$lot->id}/ownerships"];
    $routes = [
        ['post', '/units', propertiesLot($this)],
        ['patch', "/units/{$lot->id}", ['lock_version' => 1]],
        ['post', "/units/{$lot->id}/archive", []],
        ['delete', "/units/{$lot->id}/archive", []],
        ['post', "/units/{$lot->id}/ownerships", ['party_id' => $partie->id, 'share_bp' => 5000, 'nature' => 'full', 'valid_from' => '2024-01-01']],
        ['post', "/units/{$lot->id}/ownerships/{$inconnu}/end", ['valid_to' => '2025-01-01']],
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

it('refuse le lot d\'une autre organisation par unit_not_found', function (): void {
    $autre = C::organisation();
    $lotAutre = C::lot($autre, C::site($autre));
    $this->actingAs($this->titulaire);

    foreach (['', '/annexes', '/ownerships'] as $suffixe) {
        $this->getJson(C::url($this->org, "/units/{$lotAutre->id}{$suffixe}"))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    }

    $this->patchJson(C::url($this->org, "/units/{$lotAutre->id}"), ['lock_version' => 1, 'reference' => 'X'])->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    $this->postJson(C::url($this->org, "/units/{$lotAutre->id}/archive"))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    $this->postJson(C::url($this->org, '/units'), propertiesLot($this, ['property_id' => $lotAutre->property_id]))->assertNotFound()->assertJsonPath('code', 'property_not_found');
});

it('crée un lot avec ses caractéristiques, un champ personnalisé et une étiquette, puis le relit', function (): void {
    C::dans($this->org, fn () => CustomFieldDefinition::factory()->create(['entity' => CustomFieldEntity::Unit, 'key' => 'numero_place', 'type' => CustomFieldType::Text]));
    $etiquette = C::dans($this->org, fn (): Tag => Tag::factory()->create(['name' => 'Rénové', 'slug' => 'renove']));
    $this->actingAs($this->titulaire);

    $id = $this->postJson(C::url($this->org, '/units'), propertiesLot($this, [
        'characteristics' => ['rooms' => 3, 'bedrooms' => 2, 'has_balcony' => true],
        'custom_fields' => ['numero_place' => 'P12'],
        'tag_ids' => [$etiquette->id],
    ]))
        ->assertCreated()
        ->assertJsonPath('data.reference', 'A-101')
        ->assertJsonPath('data.property.name', $this->site->name)
        ->assertJsonPath('data.unit_type.key', 'apartment')
        ->assertJsonPath('data.unit_type.semantic_key', 'residential')
        ->assertJsonPath('data.floor', 1)
        ->assertJsonPath('data.surface_hundredths', 5250)
        ->assertJsonPath('data.characteristics.rooms', 3)
        ->assertJsonPath('data.characteristics.has_balcony', true)
        ->assertJsonPath('data.custom_fields.numero_place', 'P12')
        ->assertJsonPath('data.tags.0.slug', 'renove')
        ->assertJsonPath('data.parent_unit_id', null)
        ->assertJsonPath('data.lock_version', 1)
        ->assertJsonMissingPath('data.occupancy')
        ->assertJsonMissingPath('data.status')
        ->json('data.id');

    $this->getJson(C::url($this->org, "/units/{$id}"))->assertOk()->assertJsonPath('data.characteristics.bedrooms', 2);
    expect(C::dans($this->org, fn () => Unit::query()->findOrFail($id)->organization_id))->toBe($this->org->id);
});

it('valide les caractéristiques selon le sens du type de lot', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/units');
    $parking = C::terme('unit_type', 'parking')->id;

    $this->postJson($url, propertiesLot($this, ['characteristics' => ['rooms' => 'beaucoup']]))->assertUnprocessable()->assertJsonValidationErrors('characteristics.rooms');
    $this->postJson($url, propertiesLot($this, ['characteristics' => ['spot_number' => '12']]))->assertUnprocessable()->assertJsonValidationErrors('characteristics.spot_number');
    $this->postJson($url, propertiesLot($this, ['unit_type_term_id' => $parking, 'reference' => 'P-1', 'characteristics' => ['rooms' => 2]]))->assertUnprocessable()->assertJsonValidationErrors('characteristics.rooms');
    $this->postJson($url, propertiesLot($this, ['unit_type_term_id' => $parking, 'reference' => 'P-2', 'characteristics' => ['spot_number' => '12', 'covered' => true]]))
        ->assertCreated()
        ->assertJsonPath('data.characteristics.spot_number', '12')
        ->assertJsonPath('data.characteristics.covered', true);
});

it('valide le lot en liste blanche et refuse un type hors du vocabulaire des lots', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/units');

    $this->postJson($url, propertiesLot($this, ['reference' => '']))->assertUnprocessable()->assertJsonValidationErrors('reference');
    $this->postJson($url, propertiesLot($this, ['surface_hundredths' => 0]))->assertUnprocessable()->assertJsonValidationErrors('surface_hundredths');
    $this->postJson($url, propertiesLot($this, ['property_id' => 'x']))->assertUnprocessable()->assertJsonValidationErrors('property_id');
    $this->postJson($url, propertiesLot($this, ['unit_type_term_id' => C::terme('contact_category', 'craftsman')->id]))->assertNotFound()->assertJsonPath('code', 'term_not_found');
    $this->postJson($url, propertiesLot($this, ['unit_type_term_id' => fake()->uuid()]))->assertNotFound()->assertJsonPath('code', 'term_not_found');

    $this->postJson($url, propertiesLot($this))->assertCreated();
    $this->postJson($url, propertiesLot($this))->assertConflict()->assertJsonPath('code', 'unit_reference_taken');
});

it('modifie un lot avec son numéro de version et répond 409 quand il est périmé', function (): void {
    $lot = C::lot($this->org, $this->site, 'apartment', ['reference' => 'A-1']);
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, "/units/{$lot->id}");

    $this->patchJson($url, ['lock_version' => 1, 'reference' => 'A-2', 'floor' => null, 'surface_hundredths' => 6000, 'characteristics' => ['rooms' => 4]])
        ->assertOk()
        ->assertJsonPath('data.reference', 'A-2')
        ->assertJsonPath('data.floor', null)
        ->assertJsonPath('data.surface_hundredths', 6000)
        ->assertJsonPath('data.characteristics.rooms', 4)
        ->assertJsonPath('data.lock_version', 2);

    $this->patchJson($url, ['lock_version' => 1, 'reference' => 'A-3'])->assertConflict()->assertJsonPath('code', 'unit_version_conflict');
    expect(C::dans($this->org, fn () => Unit::query()->findOrFail($lot->id)->reference))->toBe('A-2');
});

it('revalide les caractéristiques quand le type du lot change', function (): void {
    $lot = C::lot($this->org, $this->site, 'apartment', ['characteristics' => ['rooms' => 3]]);
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, "/units/{$lot->id}");
    $garage = C::terme('unit_type', 'garage')->id;

    $this->patchJson($url, ['lock_version' => 1, 'unit_type_term_id' => $garage])->assertUnprocessable()->assertJsonValidationErrors('characteristics.rooms');
    $this->patchJson($url, ['lock_version' => 1, 'unit_type_term_id' => $garage, 'characteristics' => ['covered' => true]])
        ->assertOk()
        ->assertJsonPath('data.unit_type.key', 'garage')
        ->assertJsonPath('data.characteristics.covered', true);
});

it('refuse une référence déjà prise sur le site mais l\'accepte sur un autre', function (): void {
    C::lot($this->org, $this->site, 'apartment', ['reference' => 'A-1']);
    $lot = C::lot($this->org, $this->site, 'apartment', ['reference' => 'A-2']);
    $autreSite = C::site($this->org);
    $this->actingAs($this->titulaire);

    $this->patchJson(C::url($this->org, "/units/{$lot->id}"), ['lock_version' => 1, 'reference' => 'A-1'])->assertConflict()->assertJsonPath('code', 'unit_reference_taken');
    $this->postJson(C::url($this->org, '/units'), propertiesLot($this, ['property_id' => $autreSite->id, 'reference' => 'A-1']))->assertCreated();
});

it('rattache une annexe à un lot du même site et en lit l\'arborescence', function (): void {
    $principal = C::lot($this->org, $this->site, 'apartment', ['reference' => 'A-1']);
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/units');
    $cave = C::terme('unit_type', 'cellar')->id;
    $parking = C::terme('unit_type', 'parking')->id;

    $idCave = $this->postJson($url, propertiesLot($this, ['parent_unit_id' => $principal->id, 'unit_type_term_id' => $cave, 'reference' => 'A-1-CAVE']))
        ->assertCreated()->assertJsonPath('data.parent_unit_id', $principal->id)->json('data.id');
    $this->postJson($url, propertiesLot($this, ['parent_unit_id' => $idCave, 'unit_type_term_id' => $parking, 'reference' => 'A-1-PARK']))->assertCreated();
    C::lot($this->org, $this->site, 'apartment', ['reference' => 'B-1']);

    $arbre = $this->getJson(C::url($this->org, "/units/{$principal->id}/annexes"))->assertOk();

    expect($arbre->json('data.reference'))->toBe('A-1')
        ->and($arbre->json('data.annexes.0.reference'))->toBe('A-1-CAVE')
        ->and($arbre->json('data.annexes.0.annexes.0.reference'))->toBe('A-1-PARK')
        ->and($arbre->json('data.annexes.0.annexes.0.annexes'))->toBe([])
        ->and(array_column($this->getJson("{$url}?root=1")->json('data'), 'reference'))->toBe(['A-1', 'B-1'])
        ->and(array_column($this->getJson("{$url}?parent={$principal->id}")->json('data'), 'reference'))->toBe(['A-1-CAVE']);
});

it('refuse une annexe d\'un autre site, d\'une autre organisation, archivée ou circulaire', function (): void {
    $principal = C::lot($this->org, $this->site, 'apartment', ['reference' => 'A-1']);
    $annexe = C::lot($this->org, $this->site, 'cellar', ['reference' => 'A-1-CAVE', 'parent_unit_id' => $principal->id]);
    $sousAnnexe = C::lot($this->org, $this->site, 'cellar', ['reference' => 'A-1-CAVE-2', 'parent_unit_id' => $annexe->id]);
    $autreSite = C::site($this->org);
    $voisin = C::lot($this->org, $autreSite, 'apartment', ['reference' => 'Z-1']);
    $autre = C::organisation();
    $etranger = C::lot($autre, C::site($autre));
    $archive = C::lot($this->org, $this->site, 'apartment', ['reference' => 'ARCH', 'archived_at' => now()]);
    $this->actingAs($this->titulaire);
    $creation = C::url($this->org, '/units');
    $modifier = fn (Unit $lot, ?string $parent, int $version = 1) => $this->patchJson(C::url($this->org, "/units/{$lot->id}"), ['lock_version' => $version, 'parent_unit_id' => $parent]);

    $this->postJson($creation, propertiesLot($this, ['reference' => 'N-1', 'parent_unit_id' => $voisin->id]))->assertUnprocessable()->assertJsonPath('code', 'unit_parent_other_property');
    $this->postJson($creation, propertiesLot($this, ['reference' => 'N-2', 'parent_unit_id' => $etranger->id]))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    $this->postJson($creation, propertiesLot($this, ['reference' => 'N-3', 'parent_unit_id' => $archive->id]))->assertConflict()->assertJsonPath('code', 'unit_archived');

    $modifier($principal, $principal->id)->assertUnprocessable()->assertJsonPath('code', 'unit_parent_cycle');
    $modifier($principal, $sousAnnexe->id)->assertUnprocessable()->assertJsonPath('code', 'unit_parent_cycle');
    $modifier($annexe, $sousAnnexe->id)->assertUnprocessable()->assertJsonPath('code', 'unit_parent_cycle');
    $modifier($annexe, $voisin->id)->assertUnprocessable()->assertJsonPath('code', 'unit_parent_other_property');
    $modifier($annexe, $etranger->id)->assertNotFound()->assertJsonPath('code', 'unit_not_found');

    expect(C::dans($this->org, fn () => Unit::query()->findOrFail($principal->id)->parent_unit_id))->toBeNull()
        ->and(C::dans($this->org, fn () => Unit::query()->findOrFail($annexe->id)->parent_unit_id))->toBe($principal->id);

    $modifier($sousAnnexe, $principal->id)->assertOk()->assertJsonPath('data.parent_unit_id', $principal->id);
    $modifier($sousAnnexe, null, 2)->assertOk()->assertJsonPath('data.parent_unit_id', null);
});

it('garantit en base qu\'une annexe reste dans la même organisation', function (): void {
    $autre = C::organisation();
    $etranger = C::lot($autre, C::site($autre));
    $lot = C::lot($this->org, $this->site);

    expect(fn () => DB::table('units')->where('id', $lot->id)->update(['parent_unit_id' => $etranger->id]))->toThrow(QueryException::class);
});

it('limite une maison à un seul lot principal, annexes exceptées', function (): void {
    $maison = C::site($this->org, ['name' => 'Villa', 'type' => 'house']);
    $this->actingAs($this->titulaire);
    $creation = C::url($this->org, '/units');
    $corps = fn (array $s = []) => propertiesLot($this, ['property_id' => $maison->id, ...$s]);

    $principal = $this->postJson($creation, $corps(['reference' => 'VILLA']))->assertCreated()->json('data.id');
    $this->postJson($creation, $corps(['reference' => 'VILLA-2']))->assertConflict()->assertJsonPath('code', 'house_single_unit');
    $this->postJson($creation, $corps(['reference' => 'VILLA-GARAGE', 'parent_unit_id' => $principal, 'unit_type_term_id' => C::terme('unit_type', 'garage')->id]))->assertCreated();

    $immeuble = C::site($this->org, ['name' => 'Immeuble']);
    C::lot($this->org, $immeuble, 'apartment', ['reference' => 'I-1']);
    C::lot($this->org, $immeuble, 'apartment', ['reference' => 'I-2']);
    $this->patchJson(C::url($this->org, "/properties/{$immeuble->id}"), ['lock_version' => 1, 'type' => 'house'])->assertConflict()->assertJsonPath('code', 'house_single_unit');

    $this->postJson(C::url($this->org, "/units/{$principal}/archive"))->assertConflict()->assertJsonPath('code', 'unit_has_active_annexes');
});

it('archive et restaure un lot sans jamais le supprimer', function (): void {
    $lot = C::lot($this->org, $this->site, 'apartment', ['reference' => 'A-1']);
    $annexe = C::lot($this->org, $this->site, 'cellar', ['reference' => 'A-1-C', 'parent_unit_id' => $lot->id]);
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, "/units/{$lot->id}/archive");

    $this->postJson($url)->assertConflict()->assertJsonPath('code', 'unit_has_active_annexes');
    $this->postJson(C::url($this->org, "/units/{$annexe->id}/archive"))->assertOk();
    $this->postJson($url)->assertOk()->assertJsonPath('data.archived_at', fn (?string $date): bool => $date !== null);

    expect($this->getJson(C::url($this->org, '/units'))->json('data'))->toBe([])
        ->and($this->getJson(C::url($this->org, '/units?status=archived'))->json('data'))->toHaveCount(2)
        ->and($this->getJson(C::url($this->org, "/units/{$lot->id}/annexes"))->json('data.annexes'))->toBe([]);

    $this->deleteJson(C::url($this->org, "/units/{$annexe->id}/archive"))->assertConflict()->assertJsonPath('code', 'unit_archived');
    $this->deleteJson($url)->assertOk()->assertJsonPath('data.archived_at', null);
    $this->deleteJson(C::url($this->org, "/units/{$annexe->id}/archive"))->assertOk();

    $this->postJson(C::url($this->org, "/properties/{$this->site->id}/archive"))->assertConflict()->assertJsonPath('code', 'property_has_active_units');
});

it('refuse un lot dans un site archivé et sa restauration', function (): void {
    $lot = C::lot($this->org, $this->site, 'apartment', ['reference' => 'A-1']);
    $this->actingAs($this->titulaire);
    $this->postJson(C::url($this->org, "/units/{$lot->id}/archive"))->assertOk();
    $this->postJson(C::url($this->org, "/properties/{$this->site->id}/archive"))->assertOk();

    $this->postJson(C::url($this->org, '/units'), propertiesLot($this, ['reference' => 'A-9']))->assertConflict()->assertJsonPath('code', 'property_archived');
    $this->deleteJson(C::url($this->org, "/units/{$lot->id}/archive"))->assertConflict()->assertJsonPath('code', 'property_archived');
});

it('liste les lots par curseur avec recherche et filtres, sans ceux des autres organisations', function (): void {
    $parking = C::lot($this->org, $this->site, 'parking', ['reference' => 'P-1']);
    C::lot($this->org, $this->site, 'apartment', ['reference' => 'A-1']);
    C::lot($this->org, $this->site, 'apartment', ['reference' => 'A-2']);
    $autreSite = C::site($this->org, ['name' => 'Les Mimosas']);
    C::lot($this->org, $autreSite, 'apartment', ['reference' => 'M-1']);
    $autre = C::organisation();
    C::lot($autre, C::site($autre), 'apartment', ['reference' => 'A-3']);
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/units');

    $page = $this->getJson("{$url}?per_page=2")->assertOk();
    $suivante = $this->getJson("{$url}?per_page=2&cursor=".$page->json('meta.next_cursor'))->assertOk();
    $references = fn (string $requete) => array_column($this->getJson("{$url}?{$requete}")->json('data'), 'reference');

    expect(array_column($page->json('data'), 'reference'))->toBe(['A-1', 'A-2'])
        ->and(array_column($suivante->json('data'), 'reference'))->toBe(['M-1', 'P-1'])
        ->and($references('q=a-2'))->toBe(['A-2'])
        ->and($references('q=mimosas'))->toBe(['M-1'])
        ->and($references("property={$autreSite->id}"))->toBe(['M-1'])
        ->and($references('unit_type='.$parking->unit_type_term_id))->toBe(['P-1'])
        ->and($references('q=%25'))->toBe([]);

    $this->getJson("{$url}?property=pas-un-uuid")->assertUnprocessable();
});
