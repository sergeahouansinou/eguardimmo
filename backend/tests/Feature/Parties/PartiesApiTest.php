<?php

declare(strict_types=1);

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Catalog\Models\Tag;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use Tests\Feature\Parties\PartiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
});

/**
 * @return array<string, mixed>
 */
function partiesPersonne(array $surcharges = []): array
{
    return [
        'kind' => 'person',
        'last_name' => 'Dupont',
        'first_name' => 'Jean',
        'birth_date' => '1985-04-12',
        'address' => ['line1' => '12 rue du Port', 'postal_code' => '13002', 'city' => 'Marseille', 'country' => 'FR'],
        'language' => 'fr',
        ...$surcharges,
    ];
}

it('exige un jeton, un rôle suffisant et la bonne organisation sur chaque route', function (): void {
    $partie = C::partie($this->org);
    $inconnu = fake()->uuid();
    $routes = [
        ['post', '', partiesPersonne()],
        ['patch', "/{$partie->id}", ['lock_version' => 1]],
        ['post', "/{$partie->id}/archive", []],
        ['delete', "/{$partie->id}/archive", []],
        ['post', "/{$partie->id}/contact-points", ['type' => 'email', 'value' => 'a@exemple.fr']],
        ['patch', "/{$partie->id}/contact-points/{$inconnu}", ['label' => 'x']],
        ['post', "/{$partie->id}/identifiers", ['scheme' => 'siren', 'country' => 'FR', 'value' => '123456789']],
        ['patch', "/{$partie->id}/identifiers/{$inconnu}", ['value' => '123456789']],
        ['post', "/{$partie->id}/bank-accounts", ['iban' => 'FR7630006000011234567890189', 'holder_name' => 'X']],
        ['post', "/{$partie->id}/bank-accounts/{$inconnu}/replacement", ['iban' => 'FR7630006000011234567890189', 'holder_name' => 'X']],
        ['post', "/{$partie->id}/anonymization", []],
    ];
    $lectures = ['', "/{$partie->id}"];

    foreach ($lectures as $chemin) {
        $this->getJson(C::url($this->org, $chemin))->assertUnauthorized();
    }

    foreach ($routes as [$methode, $chemin, $corps]) {
        $this->json($methode, C::url($this->org, $chemin), $corps)->assertUnauthorized();
    }

    $comptable = C::membre($this->org, MemberRole::Accountant);
    C::changerDeCompte($this, $comptable);

    foreach ($lectures as $chemin) {
        $this->getJson(C::url($this->org, $chemin))->assertOk();
    }

    foreach ($routes as [$methode, $chemin, $corps]) {
        $this->json($methode, C::url($this->org, $chemin), $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    }

    $autre = C::organisation();
    C::changerDeCompte($this, C::titulaire($autre));

    foreach ($lectures as $chemin) {
        $this->getJson(C::url($this->org, $chemin))->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }

    foreach ($routes as [$methode, $chemin, $corps]) {
        $this->json($methode, C::url($this->org, $chemin), $corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }
});

it('réserve l\'anonymisation au propriétaire et à l\'administrateur', function (): void {
    $partie = C::partie($this->org);
    $url = C::url($this->org, "/{$partie->id}/anonymization");

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Manager))->postJson($url)->assertForbidden();
    C::changerDeCompte($this, C::membre($this->org, MemberRole::Admin))->postJson($url)->assertOk()->assertJsonPath('data.is_anonymized', true);
});

it('crée une personne avec adresse, catégorie, étiquette et champ personnalisé, puis la relit', function (): void {
    C::dans($this->org, fn () => CustomFieldDefinition::factory()->create(['entity' => CustomFieldEntity::Party, 'key' => 'code_portail', 'type' => CustomFieldType::Text]));
    $etiquette = C::dans($this->org, fn (): Tag => Tag::factory()->create(['name' => 'Prioritaire', 'slug' => 'prioritaire']));
    $artisan = C::terme('contact_category', 'craftsman');

    $this->actingAs($this->titulaire);
    $id = $this->postJson(C::url($this->org), partiesPersonne([
        'custom_fields' => ['code_portail' => 'A1234'],
        'contact_category_ids' => [$artisan->id],
        'tag_ids' => [$etiquette->id],
    ]))
        ->assertCreated()
        ->assertJsonPath('data.display_name', 'Jean Dupont')
        ->assertJsonPath('data.kind', 'person')
        ->assertJsonPath('data.birth_date', '1985-04-12')
        ->assertJsonPath('data.address.city', 'Marseille')
        ->assertJsonPath('data.custom_fields.code_portail', 'A1234')
        ->assertJsonPath('data.categories.0.semantic_key', 'craftsman')
        ->assertJsonPath('data.tags.0.slug', 'prioritaire')
        ->assertJsonPath('data.lock_version', 1)
        ->assertJsonPath('data.is_anonymized', false)
        ->assertJsonMissingPath('data.user_id')
        ->json('data.id');

    $this->getJson(C::url($this->org, "/{$id}"))->assertOk()->assertJsonPath('data.last_name', 'Dupont');
    expect(C::dans($this->org, fn () => Party::query()->findOrFail($id)->organization_id))->toBe($this->org->id);
});

it('crée une société avec sa forme juridique et ignore organization_id et user_id du client', function (): void {
    $forme = C::terme('legal_form', 'sarl');
    $autre = C::organisation();

    $this->actingAs($this->titulaire);
    $id = $this->postJson(C::url($this->org), [
        'kind' => 'company', 'company_name' => 'Ramonage du Port SARL', 'legal_form_term_id' => $forme->id,
        'organization_id' => $autre->id, 'user_id' => fake()->uuid(),
    ])
        ->assertCreated()
        ->assertJsonPath('data.display_name', 'Ramonage du Port SARL')
        ->assertJsonPath('data.legal_form_term_id', $forme->id)
        ->assertJsonPath('data.has_account', false)
        ->json('data.id');

    $partie = C::dans($this->org, fn (): Party => Party::query()->findOrFail($id));
    expect($partie->organization_id)->toBe($this->org->id)->and($partie->user_id)->toBeNull();

    $this->postJson(C::url($this->org), ['kind' => 'company', 'company_name' => 'X', 'legal_form_term_id' => fake()->uuid()])
        ->assertNotFound()->assertJsonPath('code', 'term_not_found');
    $this->postJson(C::url($this->org), ['kind' => 'company', 'company_name' => 'X', 'legal_form_term_id' => C::terme('contact_category', 'bailiff')->id])
        ->assertNotFound()->assertJsonPath('code', 'term_not_found');
});

it('refuse un contenu incohérent avec le type, un champ inconnu ou une date impossible', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org);

    $this->postJson($url, ['kind' => 'person', 'first_name' => 'Jean'])->assertUnprocessable()->assertJsonValidationErrors('last_name');
    $this->postJson($url, partiesPersonne(['company_name' => 'SARL X']))->assertUnprocessable()->assertJsonValidationErrors('company_name');
    $this->postJson($url, ['kind' => 'company', 'company_name' => 'SARL X', 'first_name' => 'Jean'])->assertUnprocessable()->assertJsonValidationErrors('first_name');
    $this->postJson($url, ['kind' => 'company'])->assertUnprocessable()->assertJsonValidationErrors('company_name');
    $this->postJson($url, ['kind' => 'autre'])->assertUnprocessable()->assertJsonValidationErrors('kind');
    $this->postJson($url, partiesPersonne(['birth_date' => '2999-01-01']))->assertUnprocessable()->assertJsonValidationErrors('birth_date');
    $this->postJson($url, partiesPersonne(['address' => ['line1' => 'x']]))->assertUnprocessable()->assertJsonValidationErrors(['address.city', 'address.country']);
    $this->postJson($url, partiesPersonne(['custom_fields' => ['inconnu' => 'x']]))->assertUnprocessable()->assertJsonValidationErrors('custom_fields.inconnu');
    $this->postJson($url, partiesPersonne(['contact_category_ids' => [fake()->uuid()]]))->assertNotFound()->assertJsonPath('code', 'term_not_found');
    $this->postJson($url, partiesPersonne(['tag_ids' => [fake()->uuid()]]))->assertNotFound()->assertJsonPath('code', 'tag_not_found');

    expect(C::dans($this->org, fn () => Party::query()->count()))->toBe(0);
});

it('modifie une fiche avec le verrou optimiste : une version périmée renvoie 409', function (): void {
    C::dans($this->org, fn () => CustomFieldDefinition::factory()->create(['entity' => CustomFieldEntity::Party, 'key' => 'code_portail', 'type' => CustomFieldType::Text]));
    $this->actingAs($this->titulaire);
    $id = $this->postJson(C::url($this->org), partiesPersonne())->json('data.id');
    $url = C::url($this->org, "/{$id}");

    $this->patchJson($url, ['first_name' => 'Jeanne'])->assertUnprocessable()->assertJsonValidationErrors('lock_version');

    $this->patchJson($url, ['lock_version' => 1, 'first_name' => 'Jeanne', 'custom_fields' => ['code_portail' => 'B2']])
        ->assertOk()
        ->assertJsonPath('data.display_name', 'Jeanne Dupont')
        ->assertJsonPath('data.lock_version', 2)
        ->assertJsonPath('data.custom_fields.code_portail', 'B2')
        ->assertJsonPath('data.birth_date', '1985-04-12');

    $this->patchJson($url, ['lock_version' => 1, 'first_name' => 'Pirate'])
        ->assertConflict()
        ->assertJsonPath('code', 'party_version_conflict');
    $this->getJson($url)->assertJsonPath('data.first_name', 'Jeanne')->assertJsonPath('data.lock_version', 2);

    $this->patchJson($url, ['lock_version' => 2, 'birth_date' => null, 'address' => null])
        ->assertOk()
        ->assertJsonPath('data.birth_date', null)
        ->assertJsonPath('data.address', null)
        ->assertJsonPath('data.lock_version', 3);

    $this->patchJson($url, ['lock_version' => 3, 'company_name' => 'SARL X'])->assertUnprocessable()->assertJsonValidationErrors('company_name');
    $this->patchJson($url, ['lock_version' => 3, 'last_name' => ''])->assertUnprocessable()->assertJsonValidationErrors('last_name');
});

it('remplace catégories et étiquettes seulement quand elles sont transmises', function (): void {
    $artisan = C::terme('contact_category', 'craftsman');
    $syndic = C::terme('contact_category', 'syndic');
    $etiquette = C::dans($this->org, fn (): Tag => Tag::factory()->create(['name' => 'Vacant', 'slug' => 'vacant']));

    $this->actingAs($this->titulaire);
    $id = $this->postJson(C::url($this->org), partiesPersonne(['contact_category_ids' => [$artisan->id], 'tag_ids' => [$etiquette->id]]))->json('data.id');
    $url = C::url($this->org, "/{$id}");

    $this->patchJson($url, ['lock_version' => 1, 'first_name' => 'Jo'])
        ->assertJsonPath('data.categories.0.key', 'craftsman')
        ->assertJsonPath('data.tags.0.name', 'Vacant');

    $reponse = $this->patchJson($url, ['lock_version' => 2, 'contact_category_ids' => [$syndic->id], 'tag_ids' => []])->assertOk();
    expect($reponse->json('data.categories.*.key'))->toBe(['syndic'])->and($reponse->json('data.tags'))->toBe([]);
});

it('archive et restaure sans effacer la fiche', function (): void {
    $partie = C::partie($this->org);
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, "/{$partie->id}/archive");

    $this->postJson($url)->assertOk()->assertJsonPath('data.archived_at', fn ($v): bool => $v !== null);
    $this->postJson($url)->assertOk();
    expect($this->getJson(C::url($this->org))->json('data'))->toBe([]);
    expect($this->getJson(C::url($this->org, '?status=archived'))->json('data.*.id'))->toBe([$partie->id]);

    $this->deleteJson($url)->assertOk()->assertJsonPath('data.archived_at', null);
    expect($this->getJson(C::url($this->org))->json('data.*.id'))->toBe([$partie->id]);
    expect(C::dans($this->org, fn () => Party::query()->count()))->toBe(1);
});

it('liste par curseur, recherche par nom ou e-mail et filtre par catégorie et type', function (): void {
    $artisan = C::terme('contact_category', 'craftsman');
    $this->actingAs($this->titulaire);

    $noms = [['Awa', 'Bamba'], ['Jean', 'Dupont'], ['Marie', 'Dupond'], ['Paul', 'Martin']];
    $ids = [];

    foreach ($noms as [$prenom, $nom]) {
        $ids[$nom] = $this->postJson(C::url($this->org), ['kind' => 'person', 'first_name' => $prenom, 'last_name' => $nom])->json('data.id');
    }

    $ids['Plomberie'] = $this->postJson(C::url($this->org), ['kind' => 'company', 'company_name' => 'Plomberie 100% Sud', 'contact_category_ids' => [$artisan->id]])->json('data.id');
    $this->postJson(C::url($this->org, "/{$ids['Martin']}/contact-points"), ['type' => 'email', 'value' => 'paul.martin@exemple.fr'])->assertCreated();

    $page = $this->getJson(C::url($this->org, '?per_page=2'))->assertOk()->assertJsonCount(2, 'data');
    expect($page->json('data.*.display_name'))->toBe(['Awa Bamba', 'Jean Dupont']);
    $suite = $this->getJson(C::url($this->org, '?per_page=2&cursor='.$page->json('meta.next_cursor')))->assertOk();
    expect($suite->json('data.*.display_name'))->toBe(['Marie Dupond', 'Paul Martin']);
    $this->getJson(C::url($this->org, '?cursor=n-importe-quoi'))->assertUnprocessable();

    expect($this->getJson(C::url($this->org, '?q=dupon'))->json('data.*.display_name'))->toBe(['Jean Dupont', 'Marie Dupond']);
    expect($this->getJson(C::url($this->org, '?q=PAUL.MARTIN@'))->json('data.*.id'))->toBe([$ids['Martin']]);
    expect($this->getJson(C::url($this->org, '?q=100%25'))->json('data.*.id'))->toBe([$ids['Plomberie']]);
    expect($this->getJson(C::url($this->org, '?q=%25'))->json('data.*.id'))->toBe([$ids['Plomberie']]);
    expect($this->getJson(C::url($this->org, "?category={$artisan->id}"))->json('data.*.id'))->toBe([$ids['Plomberie']]);
    expect($this->getJson(C::url($this->org, '?kind=company'))->json('data.*.id'))->toBe([$ids['Plomberie']]);
    $this->getJson(C::url($this->org, '?kind=robot'))->assertUnprocessable();
    $this->getJson(C::url($this->org, '?status=tous'))->assertUnprocessable();

    $this->getJson(C::url($this->org, '?q=martin'))->assertJsonPath('data.0.primary_email', 'paul.martin@exemple.fr');
});

it('isole les fiches par organisation', function (): void {
    $partie = C::partie($this->org);
    $autre = C::organisation();
    C::changerDeCompte($this, C::titulaire($autre));

    $this->getJson(C::url($autre))->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(C::url($autre, "/{$partie->id}"))->assertNotFound()->assertJsonPath('code', 'party_not_found');
    $this->patchJson(C::url($autre, "/{$partie->id}"), ['lock_version' => 1, 'first_name' => 'Pirate'])->assertNotFound()->assertJsonPath('code', 'party_not_found');
    $this->postJson(C::url($autre, "/{$partie->id}/archive"))->assertNotFound();
    $this->postJson(C::url($autre, "/{$partie->id}/contact-points"), ['type' => 'email', 'value' => 'a@exemple.fr'])->assertNotFound();
    $this->postJson(C::url($autre, "/{$partie->id}/anonymization"))->assertNotFound();
    $this->getJson(C::url($autre, '/pas-un-uuid'))->assertNotFound();

    expect(C::dans($this->org, fn () => Party::query()->findOrFail($partie->id)->archived_at))->toBeNull()
        ->and(C::dans($this->org, fn () => ContactPoint::query()->count()))->toBe(0);
});
