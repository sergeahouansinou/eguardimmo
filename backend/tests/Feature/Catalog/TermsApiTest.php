<?php

declare(strict_types=1);

use App\Modules\Catalog\Models\Term;
use App\Shared\Audit\AuditLog;
use Tests\Feature\Catalog\CatalogContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
});

function catalogueTermePlateforme(string $vocabulaire, string $cle): string
{
    return Term::query()->whereNull('organization_id')->where('vocabulary', $vocabulaire)->where('key', $cle)->value('id');
}

/**
 * @return array<string, mixed>
 */
function catalogueValeur(array $surcharges = []): array
{
    return [...['key' => 'ramonage', 'labels' => ['fr' => 'Ramonage'], 'semantic_key' => 'expense.maintenance'], ...$surcharges];
}

it('protège le catalogue : 401, 404 hors organisation, 403 en écriture pour un gestionnaire', function (): void {
    $this->getJson(C::url($this->org, '/vocabularies'))->assertUnauthorized();
    $this->postJson(C::url($this->org, '/vocabularies/expense_category/terms'), catalogueValeur())->assertUnauthorized();

    $etranger = C::titulaire(C::organisation());
    $this->actingAs($etranger)->getJson(C::url($this->org, '/vocabularies'))->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    $this->postJson(C::url($this->org, '/vocabularies/expense_category/terms'), catalogueValeur())->assertNotFound();

    $gestionnaire = C::gestionnaire($this->org);
    C::changerDeCompte($this, $gestionnaire)->getJson(C::url($this->org, '/vocabularies'))->assertOk();
    $this->getJson(C::url($this->org, '/vocabularies/expense_category/terms'))->assertOk();
    $this->postJson(C::url($this->org, '/vocabularies/expense_category/terms'), catalogueValeur())->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    $this->patchJson(C::url($this->org, '/terms/'.catalogueTermePlateforme('expense_category', 'other')), ['labels' => ['fr' => 'X']])->assertForbidden();
    $this->putJson(C::url($this->org, '/terms/'.catalogueTermePlateforme('expense_category', 'other').'/override'), ['hidden' => true])->assertForbidden();
});

it('déclare les référentiels et liste les valeurs de la plateforme par position', function (): void {
    $this->actingAs($this->titulaire);

    $this->getJson(C::url($this->org, '/vocabularies'))
        ->assertOk()
        ->assertJsonCount(6, 'data')
        ->assertJsonFragment(['key' => 'legal_form', 'extensible' => false, 'hierarchical' => false])
        ->assertJsonFragment(['key' => 'expense_category', 'extensible' => true, 'hierarchical' => true, 'semantic_required' => true]);

    $reponse = $this->getJson(C::url($this->org, '/vocabularies/contact_category/terms'))->assertOk();

    expect($reponse->json('data.*.key'))->toBe(['bailiff', 'craftsman', 'syndic', 'insurer', 'notary', 'accountant', 'other'])
        ->and($reponse->json('data.0.labels.fr'))->toBe('Commissaire de justice')
        ->and($reponse->json('data.0.platform'))->toBeTrue();

    $this->getJson(C::url($this->org, '/vocabularies/inconnu/terms'))->assertNotFound();
});

it('ajoute une valeur propre à l\'organisation, journalisée, invisible des autres organisations', function (): void {
    $id = $this->actingAs($this->titulaire)
        ->postJson(C::url($this->org, '/vocabularies/expense_category/terms'), catalogueValeur())
        ->assertCreated()
        ->assertJsonPath('data.key', 'ramonage')
        ->assertJsonPath('data.platform', false)
        ->assertJsonPath('data.semantic_key', 'expense.maintenance')
        ->json('data.id');

    expect(Term::query()->findOrFail($id)->organization_id)->toBe($this->org->id)
        ->and(AuditLog::query()->forSubject('term', $id)->count())->toBe(1);

    $this->getJson(C::url($this->org, '/vocabularies/expense_category/terms'))->assertJsonFragment(['key' => 'ramonage']);

    $autre = C::organisation();
    C::changerDeCompte($this, C::titulaire($autre))
        ->getJson(C::url($autre, '/vocabularies/expense_category/terms'))
        ->assertOk()
        ->assertJsonMissing(['key' => 'ramonage']);
    $this->patchJson(C::url($autre, "/terms/{$id}"), ['labels' => ['fr' => 'Piraté']])->assertNotFound()->assertJsonPath('code', 'term_not_found');
    $this->postJson(C::url($autre, "/terms/{$id}/archive"))->assertNotFound();
});

it('refuse une clé prise, une clé de la plateforme, un sens inconnu et un référentiel fermé', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/vocabularies/expense_category/terms');

    $this->postJson($url, catalogueValeur())->assertCreated();
    $this->postJson($url, catalogueValeur())->assertConflict()->assertJsonPath('code', 'term_key_taken');
    $this->postJson($url, catalogueValeur(['key' => 'insurance']))->assertConflict()->assertJsonPath('code', 'term_key_taken');

    $this->postJson($url, catalogueValeur(['key' => 'autre', 'semantic_key' => 'expense.inconnu']))->assertUnprocessable()->assertJsonValidationErrors('semantic_key');
    $this->postJson($url, catalogueValeur(['key' => 'autre', 'semantic_key' => null]))->assertUnprocessable()->assertJsonValidationErrors('semantic_key');
    $this->postJson($url, catalogueValeur(['key' => 'Mauvaise Clé']))->assertUnprocessable()->assertJsonValidationErrors('key');
    $this->postJson($url, catalogueValeur(['key' => 'sans_fr', 'labels' => ['en' => 'x']]))->assertUnprocessable()->assertJsonValidationErrors('labels.fr');
    $this->postJson($url, catalogueValeur(['key' => 'langue', 'labels' => ['fr' => 'x', 'francais' => 'y']]))->assertUnprocessable()->assertJsonValidationErrors('labels');
    $this->postJson($url, catalogueValeur(['key' => 'meta', 'metadata' => ['x' => 1]]))->assertUnprocessable()->assertJsonValidationErrors('metadata.x');
    $this->postJson($url, [...catalogueValeur(['key' => 'pirate']), 'organization_id' => 'x', 'is_system' => true])->assertCreated()->assertJsonPath('data.system', false);

    $this->postJson(C::url($this->org, '/vocabularies/legal_form/terms'), ['key' => 'gie', 'labels' => ['fr' => 'GIE']])->assertConflict()->assertJsonPath('code', 'vocabulary_closed');
    $this->postJson(C::url($this->org, '/vocabularies/inconnu/terms'), ['key' => 'gie', 'labels' => ['fr' => 'GIE']])->assertNotFound();
});

it('valide la metadata selon le référentiel', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/vocabularies/certificate_type/terms');

    $this->postJson($url, ['key' => 'ramonage', 'labels' => ['fr' => 'Ramonage'], 'metadata' => ['default_validity_months' => 12, 'reminder_days' => 30]])
        ->assertCreated()
        ->assertJsonPath('data.metadata.default_validity_months', 12)
        ->assertJsonPath('data.semantic_key', null);

    $this->postJson($url, ['key' => 'faux', 'labels' => ['fr' => 'Faux'], 'metadata' => ['default_validity_months' => 0]])->assertUnprocessable()->assertJsonValidationErrors('metadata.default_validity_months');
});

it('renomme une valeur de l\'organisation sans toucher à sa clé ni à son sens', function (): void {
    $this->actingAs($this->titulaire);
    $id = $this->postJson(C::url($this->org, '/vocabularies/expense_category/terms'), catalogueValeur())->json('data.id');

    $this->patchJson(C::url($this->org, "/terms/{$id}"), ['labels' => ['fr' => 'Ramonage annuel', 'en' => 'Chimney sweeping'], 'key' => 'autre', 'semantic_key' => 'expense.other'])
        ->assertOk()
        ->assertJsonPath('data.labels.fr', 'Ramonage annuel')
        ->assertJsonPath('data.key', 'ramonage')
        ->assertJsonPath('data.semantic_key', 'expense.maintenance');

    $this->patchJson(C::url($this->org, "/terms/{$id}"), ['labels' => ['en' => 'x']])->assertUnprocessable();
});

it('ne modifie jamais une valeur de la plateforme directement', function (): void {
    $this->actingAs($this->titulaire);
    $id = catalogueTermePlateforme('expense_category', 'other');

    $this->patchJson(C::url($this->org, "/terms/{$id}"), ['labels' => ['fr' => 'Piraté']])->assertConflict()->assertJsonPath('code', 'platform_term_immutable');
    $this->postJson(C::url($this->org, "/terms/{$id}/archive"))->assertConflict()->assertJsonPath('code', 'platform_term_immutable');
    $this->deleteJson(C::url($this->org, "/terms/{$id}/archive"))->assertConflict();

    expect(Term::query()->findOrFail($id)->labels)->toBe(['fr' => 'Autres dépenses']);
});

it('archive puis restaure une valeur : elle sort des listes sans disparaître', function (): void {
    $this->actingAs($this->titulaire);
    $id = $this->postJson(C::url($this->org, '/vocabularies/expense_category/terms'), catalogueValeur())->json('data.id');
    $liste = C::url($this->org, '/vocabularies/expense_category/terms');

    $this->postJson(C::url($this->org, "/terms/{$id}/archive"))->assertOk()->assertJsonPath('data.archived', true);
    $this->postJson(C::url($this->org, "/terms/{$id}/archive"))->assertOk();

    $this->getJson($liste)->assertJsonMissing(['key' => 'ramonage']);
    $this->getJson("{$liste}?include_inactive=1")->assertJsonFragment(['key' => 'ramonage', 'archived' => true]);
    expect(Term::query()->whereKey($id)->exists())->toBeTrue();

    $this->deleteJson(C::url($this->org, "/terms/{$id}/archive"))->assertOk()->assertJsonPath('data.archived', false);
    $this->getJson($liste)->assertJsonFragment(['key' => 'ramonage']);
});

it('surcharge une valeur de la plateforme pour la seule organisation courante', function (): void {
    $this->actingAs($this->titulaire);
    $id = catalogueTermePlateforme('contact_category', 'craftsman');
    $url = C::url($this->org, "/terms/{$id}/override");

    $this->putJson($url, ['labels' => ['fr' => 'Prestataire'], 'hidden' => false, 'position' => 10])
        ->assertOk()
        ->assertJsonPath('data.labels.fr', 'Prestataire')
        ->assertJsonPath('data.position', 10)
        ->assertJsonPath('data.overridden', true)
        ->assertJsonPath('data.key', 'craftsman');

    $this->putJson(catalogueUrlSurcharge($this->org, 'notary'), ['hidden' => true])->assertOk()->assertJsonPath('data.hidden', true);

    $liste = C::url($this->org, '/vocabularies/contact_category/terms');
    $reponse = $this->getJson($liste)->assertOk();
    expect($reponse->json('data.*.key'))->toBe(['bailiff', 'syndic', 'insurer', 'accountant', 'other', 'craftsman'])
        ->and($this->getJson("{$liste}?include_inactive=1")->json('data.*.key'))->toContain('notary');

    expect(Term::query()->findOrFail($id)->labels)->toBe(['fr' => 'Artisan']);

    $autre = C::organisation();
    C::changerDeCompte($this, C::titulaire($autre))->getJson(C::url($autre, '/vocabularies/contact_category/terms'))
        ->assertJsonPath('data.1.labels.fr', 'Artisan')
        ->assertJsonCount(7, 'data');

    C::changerDeCompte($this, $this->titulaire)->deleteJson($url)->assertOk()->assertJsonPath('data.overridden', false)->assertJsonPath('data.labels.fr', 'Artisan');
});

function catalogueUrlSurcharge(object $org, string $cle): string
{
    return C::url($org, '/terms/'.catalogueTermePlateforme('contact_category', $cle).'/override');
}

it('refuse de surcharger une valeur de l\'organisation et valide la surcharge', function (): void {
    $this->actingAs($this->titulaire);
    $propre = $this->postJson(C::url($this->org, '/vocabularies/expense_category/terms'), catalogueValeur())->json('data.id');
    $plateforme = catalogueTermePlateforme('expense_category', 'other');

    $this->putJson(C::url($this->org, "/terms/{$propre}/override"), ['hidden' => true])->assertConflict()->assertJsonPath('code', 'term_not_platform');
    $this->putJson(C::url($this->org, "/terms/{$plateforme}/override"), [])->assertUnprocessable()->assertJsonValidationErrors('hidden');
    $this->putJson(C::url($this->org, "/terms/{$plateforme}/override"), ['hidden' => false, 'position' => -1])->assertUnprocessable()->assertJsonValidationErrors('position');
    $this->putJson(C::url($this->org, '/terms/'.fake()->uuid().'/override'), ['hidden' => true])->assertNotFound()->assertJsonPath('code', 'term_not_found');
});

it('réordonne valeurs de la plateforme et valeurs propres', function (): void {
    $this->actingAs($this->titulaire);
    $propre = $this->postJson(C::url($this->org, '/vocabularies/expense_category/terms'), catalogueValeur())->json('data.id');
    $url = C::url($this->org, '/vocabularies/expense_category/terms');

    $ordre = [$propre, catalogueTermePlateforme('expense_category', 'insurance'), catalogueTermePlateforme('expense_category', 'maintenance')];
    $this->putJson("{$url}/order", ['term_ids' => $ordre])->assertOk();

    $cles = $this->getJson($url)->json('data.*.key');
    expect(array_slice($cles, 0, 3))->toBe(['ramonage', 'insurance', 'maintenance']);

    $autre = C::organisation();
    C::changerDeCompte($this, C::titulaire($autre))->getJson(C::url($autre, '/vocabularies/expense_category/terms'))->assertJsonPath('data.0.key', 'maintenance');

    C::changerDeCompte($this, $this->titulaire);
    $this->putJson("{$url}/order", ['term_ids' => [catalogueTermePlateforme('contact_category', 'bailiff')]])->assertNotFound()->assertJsonPath('code', 'term_not_found');
    $this->putJson("{$url}/order", ['term_ids' => [$propre, $propre]])->assertUnprocessable()->assertJsonValidationErrors('term_ids.1');
    $this->putJson("{$url}/order", ['term_ids' => []])->assertUnprocessable();
});

it('range les catégories de dépenses en hiérarchie et refuse un parent invalide', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/vocabularies/expense_category/terms');
    $parent = catalogueTermePlateforme('expense_category', 'maintenance');

    $this->postJson($url, catalogueValeur(['parent_id' => $parent]))->assertCreated()->assertJsonPath('data.parent_id', $parent);
    $this->postJson($url, catalogueValeur(['key' => 'orphelin', 'parent_id' => fake()->uuid()]))->assertUnprocessable()->assertJsonValidationErrors('parent_id');
    $this->postJson(C::url($this->org, '/vocabularies/contact_category/terms'), ['key' => 'plombier', 'labels' => ['fr' => 'Plombier'], 'semantic_key' => 'craftsman', 'parent_id' => catalogueTermePlateforme('contact_category', 'craftsman')])
        ->assertUnprocessable()->assertJsonValidationErrors('parent_id');

    $autre = C::organisation();
    $enfantDeLAutre = C::changerDeCompte($this, C::titulaire($autre))
        ->postJson(C::url($autre, '/vocabularies/expense_category/terms'), catalogueValeur(['key' => 'chez_autre']))->json('data.id');
    C::changerDeCompte($this, $this->titulaire)->postJson($url, catalogueValeur(['key' => 'vole', 'parent_id' => $enfantDeLAutre]))->assertUnprocessable()->assertJsonValidationErrors('parent_id');
});

it('accepte un schéma de données pour un type de pièce et refuse un schéma invalide', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/vocabularies/certificate_type/terms');
    $schema = ['classe' => ['type' => 'string', 'required' => true, 'enum' => ['A', 'B']], 'surface' => ['type' => 'integer', 'min' => 0]];

    $this->postJson($url, ['key' => 'audit_energie', 'labels' => ['fr' => 'Audit énergétique'], 'metadata' => ['data_schema' => $schema]])
        ->assertCreated()
        ->assertJsonPath('data.metadata.data_schema.classe.enum.1', 'B');

    $this->postJson($url, ['key' => 'schema_faux', 'labels' => ['fr' => 'Faux'], 'metadata' => ['data_schema' => ['x' => ['type' => 'regex:/./']]]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('metadata.data_schema.x.type');
    $this->postJson($url, ['key' => 'sans_type', 'labels' => ['fr' => 'Faux'], 'metadata' => ['data_schema' => ['x' => ['required' => true]]]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('metadata.data_schema.x.type');
});

it('fournit un schéma pour le DPE et la garantie financière de la plateforme', function (): void {
    $dpe = Term::query()->whereNull('organization_id')->where('key', 'energy_performance')->firstOrFail();
    $garantie = Term::query()->whereNull('organization_id')->where('key', 'financial_guarantee')->firstOrFail();

    expect($dpe->metadata['data_schema']['energy_class']['enum'])->toBe(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
        ->and($dpe->metadata['default_validity_months'])->toBe(120)
        ->and($garantie->metadata['data_schema']['guaranteed_amount']['type'])->toBe('integer');
});

it('refuse un schéma de données dont required n\'est pas strictement booléen', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/vocabularies/certificate_type/terms');

    foreach ([1, '1', 'true', 0, 'oui'] as $i => $required) {
        $this->postJson($url, ['key' => "requis_{$i}", 'labels' => ['fr' => 'Faux'], 'metadata' => ['data_schema' => ['x' => ['type' => 'string', 'required' => $required]]]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('metadata.data_schema.x.required');
    }

    $this->postJson($url, ['key' => 'requis_vrai', 'labels' => ['fr' => 'Vrai'], 'metadata' => ['data_schema' => ['x' => ['type' => 'string', 'required' => true]]]])
        ->assertCreated()
        ->assertJsonPath('data.metadata.data_schema.x.required', true);
});

it('refuse un nom de champ de schéma hors de ^[a-z][a-z0-9_]{0,62}$', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/vocabularies/certificate_type/terms');

    foreach (['a.b', '*', 'Majuscule', '1abc', 'a-b', str_repeat('a', 64)] as $i => $nom) {
        $this->postJson($url, ['key' => "nom_{$i}", 'labels' => ['fr' => 'Faux'], 'metadata' => ['data_schema' => [$nom => ['type' => 'string']]]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('metadata.data_schema');
    }

    $this->postJson($url, ['key' => 'nom_ok', 'labels' => ['fr' => 'Ok'], 'metadata' => ['data_schema' => [str_repeat('a', 63) => ['type' => 'string'], 'champ_2' => ['type' => 'date']]]])
        ->assertCreated();
});

it('refuse des bornes min et max qui rendent le type inutilisable', function (): void {
    $this->actingAs($this->titulaire);
    $url = C::url($this->org, '/vocabularies/certificate_type/terms');

    $refuses = [
        ['type' => 'integer', 'min' => 10, 'max' => 5],
        ['type' => 'number', 'min' => 1.5, 'max' => 1.4],
        ['type' => 'boolean', 'min' => 0],
        ['type' => 'date', 'max' => 3],
        ['type' => 'integer', 'min' => 1.5],
        ['type' => 'string', 'min' => -1],
        ['type' => 'string', 'enum' => ['A'], 'min' => 1],
        ['type' => 'boolean', 'enum' => ['A']],
    ];

    foreach ($refuses as $i => $definition) {
        $this->postJson($url, ['key' => "bornes_{$i}", 'labels' => ['fr' => 'Faux'], 'metadata' => ['data_schema' => ['x' => $definition]]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('metadata.data_schema');
    }

    $this->postJson($url, ['key' => 'bornes_ok', 'labels' => ['fr' => 'Ok'], 'metadata' => ['data_schema' => ['x' => ['type' => 'integer', 'min' => 5, 'max' => 5], 'y' => ['type' => 'string', 'min' => 0, 'max' => 20]]]])
        ->assertCreated();
});
