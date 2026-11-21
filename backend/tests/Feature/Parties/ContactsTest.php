<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use App\Modules\Parties\Models\PartyImport;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Str;
use Tests\Feature\Parties\PartiesContext as C;

beforeEach(function (): void {
    C::semer();
    $this->org = C::organisation();
    $this->titulaire = C::titulaire($this->org);
    $this->actingAs($this->titulaire);
});

/**
 * @param  array<string, mixed>  $surcharges
 * @return array<string, mixed>
 */
function contactArtisan(array $surcharges = []): array
{
    return ['kind' => 'person', 'last_name' => 'Martin', 'first_name' => 'Paul', ...$surcharges];
}

function nombreDeFiches(): int
{
    return C::dans(test()->org, fn (): int => Party::query()->count());
}

it('note : créée, modifiée, relue, effacée à l\'anonymisation et absente de l\'audit en clair', function (): void {
    $id = $this->postJson(C::url($this->org), contactArtisan(['note' => 'Intervient le matin uniquement']))
        ->assertCreated()->assertJsonPath('data.note', 'Intervient le matin uniquement')->json('data.id');

    $this->patchJson(C::url($this->org, "/{$id}"), ['lock_version' => 1, 'note' => 'Préfère les appels'])->assertOk()->assertJsonPath('data.note', 'Préfère les appels');
    $this->patchJson(C::url($this->org, "/{$id}"), ['lock_version' => 2, 'note' => ''])->assertOk()->assertJsonPath('data.note', null);
    $this->patchJson(C::url($this->org, "/{$id}"), ['lock_version' => 3, 'note' => 'Code portail 1234'])->assertOk();

    $journal = json_encode(AuditLog::query()->where('subject_id', $id)->get(['changes', 'metadata'])->toArray(), JSON_THROW_ON_ERROR);
    expect($journal)->not->toContain('Code portail')->not->toContain('Intervient')->not->toContain('Préfère');

    $this->postJson(C::url($this->org, "/{$id}/anonymization"))->assertOk()->assertJsonPath('data.note', null);
    expect(C::dans($this->org, fn () => Party::query()->findOrFail($id)->note))->toBeNull();
});

it('note : 500 caractères au plus, aucun balisage', function (): void {
    $this->postJson(C::url($this->org), contactArtisan(['note' => str_repeat('a', 501)]))->assertUnprocessable()->assertJsonValidationErrors('note');
    $this->postJson(C::url($this->org), contactArtisan(['note' => '<script>alert(1)</script>']))->assertUnprocessable()->assertJsonValidationErrors('note');
    $this->postJson(C::url($this->org), contactArtisan(['note' => str_repeat('a', 500)]))->assertCreated();
});

it('crée une fiche avec ses coordonnées et un identifiant en une requête', function (): void {
    $this->postJson(C::url($this->org), [
        'kind' => 'company', 'company_name' => 'Plomberie Rapide',
        'contact_points' => [['type' => 'email', 'value' => 'Contact@Plomberie.fr', 'label' => 'Standard'], ['type' => 'phone', 'value' => '04 91 00 00 01']],
        'identifiers' => [['scheme' => 'siren', 'country' => 'FR', 'value' => '123 456 789']],
    ])->assertCreated()
        ->assertJsonPath('data.contact_points.0.value', 'contact@plomberie.fr')
        ->assertJsonPath('data.identifiers.0.scheme', 'siren');
});

it('doublon par e-mail : 409 avec les candidats, rien créé', function (): void {
    $existante = C::partie($this->org, ['display_name' => 'Autre Nom', 'last_name' => 'Nom', 'first_name' => 'Autre']);
    C::dans($this->org, fn () => ContactPoint::query()->create(['party_id' => $existante->id, 'type' => 'email', 'value' => 'paul@exemple.fr', 'is_primary' => true, 'primary_slot' => 1]));
    $avant = nombreDeFiches();

    $reponse = $this->postJson(C::url($this->org), contactArtisan(['contact_points' => [['type' => 'email', 'value' => 'PAUL@exemple.fr']]]))
        ->assertStatus(409)->assertJsonPath('code', 'party_possible_duplicate');

    expect($reponse->json('candidates'))->toBe([['id' => $existante->id, 'display_name' => 'Autre Nom', 'reasons' => ['email']]])
        ->and(nombreDeFiches())->toBe($avant);
});

it('doublon par téléphone : formes nationale et E.164 rapprochées', function (): void {
    $existante = C::partie($this->org, ['display_name' => 'Zoé Lenoir', 'last_name' => 'Lenoir', 'first_name' => 'Zoé']);
    C::dans($this->org, fn () => ContactPoint::query()->create(['party_id' => $existante->id, 'type' => 'phone', 'value' => '+33612345678', 'is_primary' => true, 'primary_slot' => 1]));

    foreach (['06 12 34 56 78', '+33 6 12 34 56 78', '0033612345678'] as $saisie) {
        $this->postJson(C::url($this->org), contactArtisan(['contact_points' => [['type' => 'phone', 'value' => $saisie]]]))
            ->assertStatus(409)->assertJsonPath('code', 'party_possible_duplicate')->assertJsonPath('candidates.0.reasons', ['phone']);
    }

    $this->postJson(C::url($this->org), contactArtisan(['contact_points' => [['type' => 'phone', 'value' => '06 12 34 56 79']]]))->assertCreated();
});

it('doublon par identifiant', function (): void {
    $this->postJson(C::url($this->org), ['kind' => 'company', 'company_name' => 'Alpha', 'identifiers' => [['scheme' => 'siren', 'country' => 'FR', 'value' => '123456789']]])->assertCreated();

    $this->postJson(C::url($this->org), ['kind' => 'company', 'company_name' => 'Beta', 'identifiers' => [['scheme' => 'siren', 'country' => 'FR', 'value' => '123 456 789']]])
        ->assertStatus(409)->assertJsonPath('code', 'party_possible_duplicate')->assertJsonPath('candidates.0.display_name', 'Alpha')->assertJsonPath('candidates.0.reasons', ['identifier']);

    $this->postJson(C::url($this->org), ['kind' => 'company', 'company_name' => 'Beta', 'allow_duplicate' => true, 'identifiers' => [['scheme' => 'siren', 'country' => 'FR', 'value' => '123456789']]])
        ->assertStatus(409)->assertJsonPath('code', 'identifier_taken');
});

it('doublon par nom normalisé de même type seulement ; une fiche archivée ne compte pas', function (): void {
    $id = $this->postJson(C::url($this->org), contactArtisan())->assertCreated()->json('data.id');

    $this->postJson(C::url($this->org), contactArtisan(['last_name' => ' MARTIN ', 'first_name' => 'paul']))->assertStatus(409)->assertJsonPath('candidates.0.reasons', ['name']);
    $this->postJson(C::url($this->org), ['kind' => 'company', 'company_name' => 'Paul Martin'])->assertCreated();

    $this->postJson(C::url($this->org, "/{$id}/archive"))->assertOk();
    $this->postJson(C::url($this->org), contactArtisan())->assertCreated();
});

it('allow_duplicate crée quand même et l\'audite', function (): void {
    $this->postJson(C::url($this->org), contactArtisan())->assertCreated();
    $id = $this->postJson(C::url($this->org), contactArtisan(['allow_duplicate' => true]))->assertCreated()->json('data.id');

    $audit = AuditLog::query()->where('action', 'parties.duplicate.allowed')->where('subject_id', $id)->firstOrFail();
    expect($audit->metadata)->toBe(['matches' => 1, 'reasons' => 'name'])->and($audit->organization_id)->toBe($this->org->id);

    $detail = $this->getJson("/api/v1/org/{$this->org->id}/activity/{$audit->id}")->assertOk();
    expect($detail->json('data.metadata'))->toBe(['matches' => 1, 'reasons' => 'name']);

    $this->postJson(C::url($this->org), ['kind' => 'person', 'last_name' => 'Unique', 'allow_duplicate' => true])->assertCreated();
    expect(AuditLog::query()->where('action', 'parties.duplicate.allowed')->count())->toBe(1);
});

it('le doublon ne se cherche que dans l\'organisation courante', function (): void {
    $autre = C::organisation();
    C::partie($autre, ['display_name' => 'Paul Martin', 'last_name' => 'Martin', 'first_name' => 'Paul']);

    $this->postJson(C::url($this->org), contactArtisan())->assertCreated();
});

/**
 * @param  array<string, mixed>  $surcharges
 * @return array<string, mixed>
 */
function ligneImport(int $n, array $surcharges = []): array
{
    return ['kind' => 'person', 'last_name' => "Nom{$n}", 'first_name' => "Prenom{$n}", 'contact_points' => [['type' => 'email', 'value' => "contact{$n}@exemple.fr"]], ...$surcharges];
}

it('import : 201 puis rejeu 200 sans rien recréer, audité sans donnée personnelle', function (): void {
    $corps = ['client_id' => (string) Str::uuid7(), 'rows' => [ligneImport(1), ligneImport(2), ligneImport(3, ['note' => 'Fournisseur'])]];

    $premier = $this->postJson(C::url($this->org, '/import'), $corps)->assertCreated()->assertJsonPath('data.count', 3);
    expect($premier->json('data'))->toHaveKeys(['id', 'count', 'party_ids'])->and($premier->json('data.party_ids'))->toHaveCount(3)->and(nombreDeFiches())->toBe(3);

    $rejeu = $this->postJson(C::url($this->org, '/import'), $corps)->assertOk();
    expect($rejeu->json('data'))->toBe($premier->json('data'))->and(nombreDeFiches())->toBe(3)
        ->and(PartyImport::query()->count())->toBe(1);

    $audit = AuditLog::query()->where('action', 'parties.party.imported')->firstOrFail();
    expect($audit->metadata)->toBe(['count' => 3])->and($audit->organization_id)->toBe($this->org->id);

    $this->postJson(C::url($this->org, '/import'), [...$corps, 'rows' => [ligneImport(9)]])->assertStatus(409)->assertJsonPath('code', 'idempotency_key_reused');
});

it('import : tout ou rien quand une ligne est invalide, toutes les erreurs sont renvoyées sans valeur personnelle', function (): void {
    $corps = ['client_id' => (string) Str::uuid7(), 'rows' => [
        ligneImport(1),
        ['kind' => 'person', 'first_name' => 'SansNom'],
        ligneImport(3, ['contact_points' => [['type' => 'email', 'value' => 'pas-un-email']]]),
        ligneImport(4, ['birth_date' => '2999-01-01']),
    ]];

    $reponse = $this->postJson(C::url($this->org, '/import'), $corps)->assertUnprocessable()->assertJsonPath('code', 'party_import_invalid');

    expect(array_column($reponse->json('rows'), 'row'))->toBe([2, 3, 4])
        ->and($reponse->json('rows_in_error'))->toBe(3)
        ->and($reponse->getContent())->not->toContain('SansNom')->not->toContain('pas-un-email')
        ->and(nombreDeFiches())->toBe(0)
        ->and(PartyImport::query()->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'parties.party.imported')->exists())->toBeFalse();
});

it('import : 500 lignes passent, 501 sont refusées, vide refusé', function (): void {
    $this->postJson(C::url($this->org, '/import'), ['client_id' => (string) Str::uuid7(), 'rows' => array_map(fn (int $n): array => ligneImport($n), range(1, 501))])
        ->assertUnprocessable()->assertJsonValidationErrors('rows');
    $this->postJson(C::url($this->org, '/import'), ['client_id' => (string) Str::uuid7(), 'rows' => []])->assertUnprocessable()->assertJsonValidationErrors('rows');
    $this->postJson(C::url($this->org, '/import'), ['rows' => [ligneImport(1)]])->assertUnprocessable()->assertJsonValidationErrors('client_id');
    expect(nombreDeFiches())->toBe(0);

    $this->postJson(C::url($this->org, '/import'), ['client_id' => (string) Str::uuid7(), 'rows' => array_map(fn (int $n): array => ligneImport($n), range(1, 500))])
        ->assertCreated()->assertJsonPath('data.count', 500);
    expect(nombreDeFiches())->toBe(500);
});

it('import : doublons dans la base ou dans le fichier refusés, sauf allow_duplicates', function (): void {
    $existante = C::partie($this->org, ['display_name' => 'Nom1 Prenom1', 'last_name' => 'Nom1', 'first_name' => 'Prenom1']);
    C::dans($this->org, fn () => ContactPoint::query()->create(['party_id' => $existante->id, 'type' => 'email', 'value' => 'contact1@exemple.fr', 'is_primary' => true, 'primary_slot' => 1]));
    $corps = ['client_id' => (string) Str::uuid7(), 'rows' => [ligneImport(1), ligneImport(2), ligneImport(3, ['contact_points' => [['type' => 'email', 'value' => 'contact2@exemple.fr']]])]];

    $reponse = $this->postJson(C::url($this->org, '/import'), $corps)->assertStatus(409)->assertJsonPath('code', 'party_possible_duplicate');

    expect($reponse->json('rows.0.row'))->toBe(1)->and($reponse->json('rows.0.candidates.0.id'))->toBe($existante->id)
        ->and($reponse->json('rows.1.row'))->toBe(3)->and($reponse->json('rows.1.duplicate_of_rows'))->toBe([2])->and($reponse->json('rows.1.candidates'))->toBe([])
        ->and(nombreDeFiches())->toBe(1);

    $this->postJson(C::url($this->org, '/import'), [...$corps, 'allow_duplicates' => true])->assertCreated()->assertJsonPath('data.count', 3);
    expect(nombreDeFiches())->toBe(4);
});

it('import : 401 sans jeton, 403 pour le comptable, 404 hors organisation', function (): void {
    $corps = fn (): array => ['client_id' => (string) Str::uuid7(), 'rows' => [ligneImport(1)]];

    auth()->forgetGuards();
    $this->postJson(C::url($this->org, '/import'), $corps())->assertUnauthorized();

    C::changerDeCompte($this, C::membre($this->org, MemberRole::Accountant))->postJson(C::url($this->org, '/import'), $corps())->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    C::changerDeCompte($this, C::membre($this->org, MemberRole::Manager))->postJson(C::url($this->org, '/import'), $corps())->assertCreated();
    C::changerDeCompte($this, C::titulaire(C::organisation()))->postJson(C::url($this->org, '/import'), $corps())->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    expect(nombreDeFiches())->toBe(1);
});

it('import : limité à cinq par heure', function (): void {
    foreach (range(1, 5) as $n) {
        $this->postJson(C::url($this->org, '/import'), ['client_id' => (string) Str::uuid7(), 'rows' => [ligneImport($n)]])->assertCreated();
    }

    $this->postJson(C::url($this->org, '/import'), ['client_id' => (string) Str::uuid7(), 'rows' => [ligneImport(6)]])->assertStatus(429);
});
