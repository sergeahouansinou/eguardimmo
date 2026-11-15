<?php

declare(strict_types=1);

use App\Modules\Catalog\Actions\CreateCustomField;
use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Catalog\PublicApi\CustomFieldValidator;
use Tests\Feature\Catalog\CatalogContext as C;

beforeEach(function (): void {
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
});

/**
 * @return array<string, mixed>
 */
function catalogueChamp(array $surcharges = []): array
{
    return [...['key' => 'place_parking', 'labels' => ['fr' => 'Place de parking'], 'type' => 'text'], ...$surcharges];
}

function catalogueOptions(): array
{
    return [['key' => 'nord', 'labels' => ['fr' => 'Nord']], ['key' => 'sud', 'labels' => ['fr' => 'Sud']]];
}

it('protège les champs personnalisés : 401, 404 hors organisation, 403 pour un gestionnaire en écriture', function (): void {
    $url = C::url($this->org, '/custom-fields/unit');

    $this->getJson($url)->assertUnauthorized();
    $this->postJson($url, catalogueChamp())->assertUnauthorized();

    $this->actingAs(C::titulaire(C::organisation()))->getJson($url)->assertNotFound();
    $this->postJson($url, catalogueChamp())->assertNotFound();

    C::changerDeCompte($this, C::gestionnaire($this->org))->getJson($url)->assertOk();
    $this->postJson($url, catalogueChamp())->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    $this->patchJson(C::url($this->org, '/custom-fields/'.fake()->uuid()), ['required' => true])->assertForbidden();
    $this->postJson(C::url($this->org, '/custom-fields/'.fake()->uuid().'/archive'))->assertForbidden();
});

it('crée, liste et modifie un champ personnalisé par objet', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/custom-fields/unit');

    $id = $this->postJson($url, catalogueChamp(['required' => true]))
        ->assertCreated()
        ->assertJsonPath('data.entity', 'unit')
        ->assertJsonPath('data.type', 'text')
        ->assertJsonPath('data.required', true)
        ->assertJsonPath('data.type_locked', false)
        ->json('data.id');

    $this->postJson(C::url($this->org, '/custom-fields/lease'), catalogueChamp(['key' => 'code_portail']))->assertCreated();

    $this->getJson($url)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.key', 'place_parking');
    $this->getJson(C::url($this->org, '/custom-fields/lease'))->assertJsonCount(1, 'data')->assertJsonPath('data.0.key', 'code_portail');
    $this->getJson(C::url($this->org, '/custom-fields/tenant'))->assertNotFound();

    $this->patchJson(C::url($this->org, "/custom-fields/{$id}"), ['labels' => ['fr' => 'Parking'], 'required' => false, 'position' => 5, 'key' => 'autre', 'entity' => 'lease'])
        ->assertOk()
        ->assertJsonPath('data.labels.fr', 'Parking')
        ->assertJsonPath('data.required', false)
        ->assertJsonPath('data.position', 5)
        ->assertJsonPath('data.key', 'place_parking')
        ->assertJsonPath('data.entity', 'unit');
});

it('accepte chaque type avec ses options ou son référentiel et refuse les formes incohérentes', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/custom-fields/property');

    foreach (['number', 'money', 'date', 'bool', 'url'] as $type) {
        $this->postJson($url, catalogueChamp(['key' => "champ_{$type}", 'type' => $type]))->assertCreated()->assertJsonPath('data.type', $type);
    }

    $this->postJson($url, catalogueChamp(['key' => 'orientation', 'type' => 'select', 'options' => catalogueOptions()]))->assertCreated()->assertJsonPath('data.options.1.key', 'sud');
    $this->postJson($url, catalogueChamp(['key' => 'orientations', 'type' => 'multiselect', 'options' => catalogueOptions()]))->assertCreated();
    $this->postJson($url, catalogueChamp(['key' => 'categorie', 'type' => 'term', 'vocabulary' => 'unit_type']))->assertCreated()->assertJsonPath('data.vocabulary', 'unit_type');

    $this->postJson($url, catalogueChamp(['key' => 'sans_options', 'type' => 'select']))->assertUnprocessable()->assertJsonValidationErrors('options');
    $this->postJson($url, catalogueChamp(['key' => 'texte_options', 'options' => catalogueOptions()]))->assertUnprocessable()->assertJsonValidationErrors('options');
    $this->postJson($url, catalogueChamp(['key' => 'sans_ref', 'type' => 'term']))->assertUnprocessable()->assertJsonValidationErrors('vocabulary');
    $this->postJson($url, catalogueChamp(['key' => 'texte_ref', 'vocabulary' => 'unit_type']))->assertUnprocessable()->assertJsonValidationErrors('vocabulary');
    $this->postJson($url, catalogueChamp(['key' => 'type_inconnu', 'type' => 'json']))->assertUnprocessable()->assertJsonValidationErrors('type');
    $this->postJson($url, catalogueChamp(['key' => 'doublon', 'type' => 'select', 'options' => [...catalogueOptions(), ['key' => 'nord', 'labels' => ['fr' => 'Autre']]]]))->assertUnprocessable();
    $this->postJson($url, catalogueChamp(['key' => 'Clé Invalide']))->assertUnprocessable()->assertJsonValidationErrors('key');
    $this->postJson($url, catalogueChamp(['key' => 'sans_libelle', 'labels' => []]))->assertUnprocessable()->assertJsonValidationErrors('labels');
});

it('refuse une clé déjà prise par objet mais l\'autorise sur un autre objet', function (): void {
    $this->actingAs($this->titulaire);

    $this->postJson(C::url($this->org, '/custom-fields/unit'), catalogueChamp())->assertCreated();
    $this->postJson(C::url($this->org, '/custom-fields/unit'), catalogueChamp())->assertConflict()->assertJsonPath('code', 'custom_field_key_taken');
    $this->postJson(C::url($this->org, '/custom-fields/lease'), catalogueChamp())->assertCreated();

    $autre = C::organisation();
    C::changerDeCompte($this, C::titulaire($autre))->postJson(C::url($autre, '/custom-fields/unit'), catalogueChamp())->assertCreated();
});

it('plafonne le nombre de champs par objet', function (): void {
    C::dans($this->org, function (): void {
        CustomFieldDefinition::factory()->count(CreateCustomField::LIMITE_PAR_OBJET)->create(['entity' => CustomFieldEntity::Mandate]);
    });

    $this->actingAs($this->titulaire)->postJson(C::url($this->org, '/custom-fields/mandate'), catalogueChamp())->assertConflict()->assertJsonPath('code', 'custom_field_limit_reached');
});

it('fige le type dès qu\'une valeur existe mais laisse compléter les options', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/custom-fields/unit');
    $id = $this->postJson($url, catalogueChamp(['key' => 'orientation', 'type' => 'select', 'options' => catalogueOptions()]))->json('data.id');

    $this->patchJson(C::url($this->org, "/custom-fields/{$id}"), ['type' => 'text', 'options' => null])->assertOk()->assertJsonPath('data.type', 'text');
    $this->patchJson(C::url($this->org, "/custom-fields/{$id}"), ['type' => 'select', 'options' => catalogueOptions()])->assertOk();

    C::dans($this->org, fn () => app(CustomFieldValidator::class)->recordUsage(CustomFieldEntity::Unit, ['orientation' => 'nord']));

    $this->getJson($url)->assertJsonPath('data.0.type_locked', true);
    $this->patchJson(C::url($this->org, "/custom-fields/{$id}"), ['type' => 'text', 'options' => null])->assertConflict()->assertJsonPath('code', 'custom_field_type_locked');
    $this->patchJson(C::url($this->org, "/custom-fields/{$id}"), ['options' => [['key' => 'nord', 'labels' => ['fr' => 'Nord']]]])->assertConflict()->assertJsonPath('code', 'custom_field_type_locked');
    $this->patchJson(C::url($this->org, "/custom-fields/{$id}"), ['options' => [...catalogueOptions(), ['key' => 'est', 'labels' => ['fr' => 'Est']]], 'labels' => ['fr' => 'Orientation']])
        ->assertOk()->assertJsonCount(3, 'data.options');
});

it('archive et restaure un champ sans perdre sa définition', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/custom-fields/unit');
    $id = $this->postJson($url, catalogueChamp())->json('data.id');

    $this->postJson(C::url($this->org, "/custom-fields/{$id}/archive"))->assertOk()->assertJsonPath('data.archived', true);
    $this->getJson($url)->assertJsonCount(0, 'data');
    $this->getJson("{$url}?include_archived=1")->assertJsonCount(1, 'data')->assertJsonPath('data.0.archived', true);

    $this->deleteJson(C::url($this->org, "/custom-fields/{$id}/archive"))->assertOk()->assertJsonPath('data.archived', false);
    $this->getJson($url)->assertJsonCount(1, 'data');
});

it('ne laisse pas atteindre le champ d\'une autre organisation', function (): void {
    $autre = C::organisation();
    $id = C::changerDeCompte($this, C::titulaire($autre))->postJson(C::url($autre, '/custom-fields/unit'), catalogueChamp())->json('data.id');

    C::changerDeCompte($this, $this->titulaire);
    $this->patchJson(C::url($this->org, "/custom-fields/{$id}"), ['required' => true])->assertNotFound()->assertJsonPath('code', 'custom_field_not_found');
    $this->postJson(C::url($this->org, "/custom-fields/{$id}/archive"))->assertNotFound();
    $this->deleteJson(C::url($this->org, "/custom-fields/{$id}/archive"))->assertNotFound();
    $this->getJson(C::url($this->org, '/custom-fields/unit'))->assertJsonCount(0, 'data');
});
