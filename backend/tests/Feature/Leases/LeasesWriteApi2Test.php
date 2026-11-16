<?php

declare(strict_types=1);

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Properties\Models\Unit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeaseEndContext as E;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseSignContext as S;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
});

/**
 * @return array{bail: Lease, lot: Unit, partie: LeaseParty, lotLigne: LeaseUnit}
 */
function leaseHttpDossier(Organization $org): array
{
    ['bail' => $bail, 'lot' => $lot] = E::bail($org);

    return [
        'bail' => $bail,
        'lot' => $lot,
        'partie' => L::dans($org, fn (): LeaseParty => LeaseParty::query()->where('lease_id', $bail->id)->firstOrFail()),
        'lotLigne' => L::dans($org, fn (): LeaseUnit => LeaseUnit::query()->where('lease_id', $bail->id)->firstOrFail()),
    ];
}

/**
 * @return list<array{0: string, 1: array<string, mixed>}>
 */
function leaseHttpEcritures3(string $bail, string $partie, string $lotLigne): array
{
    $racine = "/{$bail}";

    return [
        ["{$racine}/parties", ['lock_version' => 1, 'party_id' => (string) Str::uuid7(), 'role' => 'tenant']],
        ["{$racine}/parties/{$partie}/end", ['lock_version' => 1, 'valid_to' => '2027-01-01']],
        ["{$racine}/units", ['lock_version' => 1, 'unit_id' => (string) Str::uuid7(), 'is_main' => false, 'valid_from' => '2026-06-01']],
        ["{$racine}/units/{$lotLigne}/end", ['lock_version' => 1, 'valid_to' => '2027-01-01']],
        ["{$racine}/notice", ['lock_version' => 1, 'notice_given_by' => 'tenant', 'notice_received_on' => '2026-11-10', 'termination_reason' => 'Mutation']],
        ["{$racine}/terminate", ['lock_version' => 1, 'ends_on' => '2027-01-31', 'amicable' => true, 'termination_reason' => 'Accord', 'requested_by' => 'tenant']],
        ["{$racine}/renew", ['lock_version' => 1, 'duration_months' => 36]],
    ];
}

it('exige un jeton, un rôle d\'écriture et l\'appartenance à l\'organisation sur chaque route de la vague 3', function (): void {
    $d = leaseHttpDossier($this->org);
    $routes = leaseHttpEcritures3($d['bail']->id, $d['partie']->id, $d['lotLigne']->id);

    foreach ($routes as [$chemin, $corps]) {
        $this->postJson(R::url($this->org, $chemin), $corps)->assertUnauthorized();
    }

    R::changerDeCompte($this, L::membre($this->org, MemberRole::Accountant));

    foreach ($routes as [$chemin, $corps]) {
        $this->postJson(R::url($this->org, $chemin), $corps)->assertForbidden()->assertJsonPath('code', 'role_forbidden');
    }

    R::changerDeCompte($this, L::titulaire(L::organisation()));

    foreach ($routes as [$chemin, $corps]) {
        $this->postJson(R::url($this->org, $chemin), $corps)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
    }

    expect(E::champs($this->org, $d['bail'])['version'])->toBe(1)
        ->and(E::lignes($this->org, $d['bail'])['parties'])->toHaveCount(1)
        ->and(E::lignes($this->org, $d['bail'])['units'])->toHaveCount(1);
});

it('répond lease_not_found pour le bail d\'une autre organisation, avec ses propres lignes', function (): void {
    $autre = L::organisation();
    $etranger = leaseHttpDossier($autre);
    $this->actingAs($this->titulaire);

    foreach (leaseHttpEcritures3($etranger['bail']->id, $etranger['partie']->id, $etranger['lotLigne']->id) as [$chemin, $corps]) {
        $this->postJson(R::url($this->org, $chemin), $corps)->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    }

    expect(E::champs($autre, $etranger['bail'])['version'])->toBe(1)
        ->and(E::lignes($autre, $etranger['bail'])['parties'][0]['to'])->toBeNull();
});

it('répond 404 pour la ligne d\'un autre bail de la même organisation ou d\'une autre organisation', function (): void {
    $a = leaseHttpDossier($this->org);
    $b = leaseHttpDossier($this->org);
    $autre = L::organisation();
    $etranger = leaseHttpDossier($autre);
    $this->actingAs($this->titulaire);

    foreach ([$b, $etranger] as $cible) {
        $this->postJson(R::url($this->org, "/{$a['bail']->id}/parties/{$cible['partie']->id}/end"), ['lock_version' => 1, 'valid_to' => '2027-01-01'])
            ->assertNotFound()->assertJsonPath('code', 'lease_party_not_found');
        $this->postJson(R::url($this->org, "/{$a['bail']->id}/units/{$cible['lotLigne']->id}/end"), ['lock_version' => 1, 'valid_to' => '2027-01-01', 'replace_with_unit_id' => (string) L::lot($this->org)->id])
            ->assertNotFound()->assertJsonPath('code', 'lease_unit_not_found');
    }

    expect(E::lignes($this->org, $a['bail'])['parties'][0]['to'])->toBeNull()
        ->and(E::lignes($this->org, $b['bail'])['parties'][0]['to'])->toBeNull()
        ->and(E::lignes($this->org, $b['bail'])['units'][0]['to'])->toBeNull()
        ->and(E::lignes($autre, $etranger['bail'])['units'][0]['to'])->toBeNull()
        ->and(E::champs($this->org, $a['bail'])['version'])->toBe(1);
});

it('répond 404 pour un identifiant de bail, de partie ou de lot mal formé', function (): void {
    $d = leaseHttpDossier($this->org);
    $this->actingAs($this->titulaire);

    foreach (leaseHttpEcritures3('pas-un-uuid', $d['partie']->id, $d['lotLigne']->id) as [$chemin, $corps]) {
        $this->postJson(R::url($this->org, $chemin), $corps)->assertNotFound()->assertJsonPath('code', 'not_found');
    }

    $this->postJson(R::url($this->org, "/{$d['bail']->id}/parties/pas-un-uuid/end"), ['lock_version' => 1, 'valid_to' => '2027-01-01'])->assertNotFound()->assertJsonPath('code', 'not_found');
    $this->postJson(R::url($this->org, "/{$d['bail']->id}/units/pas-un-uuid/end"), ['lock_version' => 1, 'valid_to' => '2027-01-01'])->assertNotFound()->assertJsonPath('code', 'not_found');
    expect(E::champs($this->org, $d['bail'])['version'])->toBe(1);
});

it('ajoute un colocataire puis en retire un, version à l\'appui, et protège le dernier locataire', function (): void {
    $d = leaseHttpDossier($this->org);
    $nouveau = L::partie($this->org);
    $this->actingAs($this->titulaire);

    $this->postJson(R::url($this->org, "/{$d['bail']->id}/parties"), ['lock_version' => 1, 'party_id' => $nouveau->id, 'role' => 'tenant', 'joint_liability' => true, 'status' => 'terminated', 'organization_id' => (string) Str::uuid7()])
        ->assertCreated()
        ->assertJsonPath('data.id', $d['bail']->id)
        ->assertJsonPath('data.status', 'signed')
        ->assertJsonPath('data.lock_version', 2)
        ->assertJsonCount(2, 'data.parties')
        ->assertJsonPath('data.parties.1.party.id', $nouveau->id)
        ->assertJsonPath('data.parties.1.party.kind', fn (string $nature): bool => $nature !== '')
        ->assertJsonPath('data.parties.1.role', 'tenant')
        ->assertJsonPath('data.parties.1.valid_from', '2026-11-16')
        ->assertJsonPath('data.parties.1.end_date', null);

    $fin = fn (string $ligne, int $version) => $this->postJson(R::url($this->org, "/{$d['bail']->id}/parties/{$ligne}/end"), ['lock_version' => $version, 'valid_to' => '2027-01-01']);

    $fin($d['partie']->id, 1)->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    $fin($d['partie']->id, 2)->assertOk()
        ->assertJsonPath('data.lock_version', 3)
        ->assertJsonPath('data.parties.0.end_date', '2026-12-31')
        ->assertJsonPath('data.parties.1.end_date', null);

    $restant = E::lignes($this->org, $d['bail'])['parties'][1];
    $dernier = L::dans($this->org, fn (): string => LeaseParty::query()->where('party_id', $nouveau->id)->firstOrFail()->id);
    $fin($dernier, 3)->assertConflict()->assertJsonPath('code', 'lease_last_tenant');

    expect($restant['to'])->toBeNull()
        ->and(E::champs($this->org, $d['bail'])['version'])->toBe(3);
});

it('valide les corps des routes de parties', function (): void {
    $d = leaseHttpDossier($this->org);
    $this->actingAs($this->titulaire);

    $this->postJson(R::url($this->org, "/{$d['bail']->id}/parties"), [])->assertUnprocessable()->assertJsonValidationErrors(['lock_version', 'party_id', 'role']);
    $this->postJson(R::url($this->org, "/{$d['bail']->id}/parties"), ['lock_version' => 1, 'party_id' => 'x', 'role' => 'roi'])->assertUnprocessable()->assertJsonValidationErrors(['party_id', 'role']);
    $this->postJson(R::url($this->org, "/{$d['bail']->id}/parties/{$d['partie']->id}/end"), ['lock_version' => 1, 'valid_to' => '01/01/2027'])->assertUnprocessable()->assertJsonValidationErrors('valid_to');
    $this->postJson(R::url($this->org, "/{$d['bail']->id}/parties/{$d['partie']->id}/end"), ['valid_to' => '2027-01-01'])->assertUnprocessable()->assertJsonValidationErrors('lock_version');

    expect(E::champs($this->org, $d['bail'])['version'])->toBe(1);
});

it('ajoute une annexe puis la ferme, et refuse un lot déjà loué ou un second lot principal', function (): void {
    $d = leaseHttpDossier($this->org);
    $annexe = L::lot($this->org);
    $this->actingAs($this->titulaire);
    $url = R::url($this->org, "/{$d['bail']->id}/units");

    $reponse = $this->postJson($url, ['lock_version' => 1, 'unit_id' => $annexe->id, 'is_main' => false, 'valid_from' => '2026-06-01', 'status' => 'terminated'])
        ->assertCreated()
        ->assertJsonPath('data.id', $d['bail']->id)
        ->assertJsonPath('data.status', 'signed')
        ->assertJsonPath('data.lock_version', 2)
        ->assertJsonCount(2, 'data.units')
        ->assertJsonPath('data.units.1.unit.id', $annexe->id)
        ->assertJsonPath('data.units.1.is_main', false)
        ->assertJsonPath('data.units.1.valid_from', '2026-06-01')
        ->assertJsonPath('data.units.1.end_date', null);

    $this->postJson($url, ['lock_version' => 2, 'unit_id' => $annexe->id, 'is_main' => false, 'valid_from' => '2026-07-01'])->assertConflict()->assertJsonPath('code', 'lease_unit_conflict');
    $this->postJson($url, ['lock_version' => 2, 'unit_id' => L::lot($this->org)->id, 'is_main' => true, 'valid_from' => '2026-07-01'])->assertConflict()->assertJsonPath('code', 'lease_main_unit_conflict');

    $loue = L::lot($this->org);
    S::bailSigneSur($this->org, $loue, ['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01']);
    $this->postJson($url, ['lock_version' => 2, 'unit_id' => $loue->id, 'is_main' => false, 'valid_from' => '2026-07-01'])->assertConflict()->assertJsonPath('code', 'lease_overlap');
    $this->postJson($url, ['lock_version' => 1, 'unit_id' => L::lot($this->org)->id, 'is_main' => false, 'valid_from' => '2026-07-01'])->assertConflict()->assertJsonPath('code', 'lease_stale_version');

    $ligne = $reponse->json('data.units.1.id');
    $this->postJson(R::url($this->org, "/{$d['bail']->id}/units/{$ligne}/end"), ['lock_version' => 2, 'valid_to' => '2026-09-01'])->assertOk()
        ->assertJsonPath('data.lock_version', 3)
        ->assertJsonPath('data.units.1.end_date', '2026-08-31');

    expect(E::champs($this->org, $d['bail'])['version'])->toBe(3);
});

it('ne ferme le lot principal qu\'avec un lot de remplacement', function (): void {
    $d = leaseHttpDossier($this->org);
    $relais = L::lot($this->org);
    $this->actingAs($this->titulaire);
    $url = R::url($this->org, "/{$d['bail']->id}/units/{$d['lotLigne']->id}/end");

    $this->postJson($url, ['lock_version' => 1, 'valid_to' => '2026-12-01'])->assertUnprocessable()->assertJsonPath('code', 'lease_no_main_unit');
    expect(E::champs($this->org, $d['bail'])['version'])->toBe(1);

    $this->postJson($url, ['lock_version' => 1, 'valid_to' => '2026-12-01', 'replace_with_unit_id' => $relais->id])->assertOk()
        ->assertJsonPath('data.lock_version', 2)
        ->assertJsonPath('data.units.0.end_date', '2026-11-30')
        ->assertJsonPath('data.units.1.unit.id', $relais->id)
        ->assertJsonPath('data.units.1.is_main', true)
        ->assertJsonPath('data.main_unit.id', $d['lot']->id);
});

it('valide les corps des routes de lots', function (): void {
    $d = leaseHttpDossier($this->org);
    $this->actingAs($this->titulaire);

    $this->postJson(R::url($this->org, "/{$d['bail']->id}/units"), [])->assertUnprocessable()->assertJsonValidationErrors(['lock_version', 'unit_id', 'valid_from']);
    $this->postJson(R::url($this->org, "/{$d['bail']->id}/units/{$d['lotLigne']->id}/end"), ['lock_version' => 1, 'valid_to' => 'demain'])->assertUnprocessable()->assertJsonValidationErrors('valid_to');
    $this->postJson(R::url($this->org, "/{$d['bail']->id}/units/{$d['lotLigne']->id}/end"), ['lock_version' => 1, 'valid_to' => '2027-01-01', 'replace_with_unit_id' => 'x'])->assertUnprocessable()->assertJsonValidationErrors('replace_with_unit_id');

    expect(E::champs($this->org, $d['bail'])['version'])->toBe(1);
});
