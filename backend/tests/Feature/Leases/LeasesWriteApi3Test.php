<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeaseDraftContext as D;
use Tests\Feature\Leases\LeaseEndContext as E;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Leases\LeaseTermsReviseContext as T;
use Tests\Feature\Leases\LeaseUnitsContext as U;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
});

it('enregistre un préavis, refuse le second sans remplacement et valide les entrées', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $this->actingAs($this->titulaire);
    $url = R::url($this->org, "/{$bail->id}/notice");
    $corps = ['lock_version' => 1, 'notice_given_by' => 'tenant', 'notice_received_on' => '2026-11-10', 'termination_reason' => 'Mutation professionnelle'];

    $this->postJson($url, [...$corps, 'status' => 'terminated', 'ends_on' => '2026-12-01'])->assertOk()
        ->assertJsonPath('data.id', $bail->id)
        ->assertJsonPath('data.status', 'signed')
        ->assertJsonPath('data.lock_version', 2)
        ->assertJsonPath('data.notice.given_by', 'tenant')
        ->assertJsonPath('data.notice.received_on', '2026-11-10')
        ->assertJsonPath('data.notice.departure_on', '2027-02-10')
        ->assertJsonPath('data.notice.reason', 'Mutation professionnelle');

    $this->postJson($url, [...$corps, 'lock_version' => 1])->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    $this->postJson($url, [...$corps, 'lock_version' => 2])->assertConflict()->assertJsonPath('code', 'lease_notice_exists');
    $this->postJson($url, ['lock_version' => 2])->assertUnprocessable()->assertJsonValidationErrors(['notice_given_by', 'notice_received_on']);

    expect(E::champs($this->org, $bail))->toMatchArray(['status' => 'signed', 'version' => 2, 'ends_on' => '2029-01-01']);
});

it('résilie à la date du préavis, ferme les lignes et refuse une seconde résiliation', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $this->actingAs($this->titulaire);
    $this->postJson(R::url($this->org, "/{$bail->id}/notice"), ['lock_version' => 1, 'notice_given_by' => 'tenant', 'notice_received_on' => '2026-11-10', 'termination_reason' => 'Mutation'])->assertOk();
    $url = R::url($this->org, "/{$bail->id}/terminate");

    $this->postJson($url, ['lock_version' => 1])->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    $this->postJson($url, ['lock_version' => 2, 'ends_on' => '2026-12-01'])->assertUnprocessable()->assertJsonPath('code', 'lease_notice_invalid');

    $this->postJson($url, ['lock_version' => 2])->assertOk()
        ->assertJsonPath('data.status', 'terminated')
        ->assertJsonPath('data.phase', 'notice')
        ->assertJsonPath('data.end_date', '2027-02-09')
        ->assertJsonPath('data.lock_version', 3)
        ->assertJsonPath('data.units.0.end_date', '2027-02-09')
        ->assertJsonPath('data.parties.0.end_date', '2027-02-09');

    $this->postJson($url, ['lock_version' => 3])->assertConflict()->assertJsonPath('code', 'lease_already_terminated');
    expect(E::champs($this->org, $bail))->toMatchArray(['status' => 'terminated', 'version' => 3, 'ends_on' => '2027-02-10']);
});

it('refuse une résiliation sans préavis ni accord amiable motivé', function (): void {
    ['bail' => $bail] = E::bail($this->org);
    $this->actingAs($this->titulaire);
    $url = R::url($this->org, "/{$bail->id}/terminate");

    $this->postJson($url, ['lock_version' => 1])->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');
    $this->postJson($url, ['lock_version' => 1, 'ends_on' => '2027-01-31'])->assertUnprocessable()->assertJsonPath('code', 'lease_notice_invalid');
    $this->postJson($url, ['lock_version' => 1, 'ends_on' => '2027-01-31', 'amicable' => true])->assertUnprocessable()->assertJsonValidationErrors('termination_reason');

    expect(E::champs($this->org, $bail))->toMatchArray(['status' => 'signed', 'version' => 1]);
});

it('renouvelle un bail arrivé à terme et révise le loyer, puis refuse un bail non renouvelable', function (): void {
    ['bail' => $bail] = E::bail($this->org, ['starts_on' => '2023-11-16', 'ends_on' => '2026-11-16']);
    ['bail' => $futur] = E::bail($this->org, ['starts_on' => '2026-01-01', 'ends_on' => '2026-12-20', 'tacit_renewal' => true]);
    $this->actingAs($this->titulaire);
    $url = R::url($this->org, "/{$bail->id}/renew");
    $corps = ['lock_version' => 1, 'duration_months' => 36, 'changes' => [['component_term_id' => L::composante('rent')->id, 'amount' => 66500]]];

    $this->postJson($url, [...$corps, 'lock_version' => 4])->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    $this->postJson($url, [...$corps, 'duration_months' => 0])->assertUnprocessable()->assertJsonValidationErrors('duration_months');
    $this->postJson($url, [...$corps, 'changes' => [['amount' => 1]]])->assertUnprocessable()->assertJsonValidationErrors('changes.0.component_term_id');
    $this->postJson(R::url($this->org, "/{$futur->id}/renew"), ['lock_version' => 1])->assertConflict()->assertJsonPath('code', 'lease_renewal_not_allowed');

    $this->postJson($url, $corps)->assertOk()
        ->assertJsonPath('data.id', $bail->id)
        ->assertJsonPath('data.end_date', '2029-11-15')
        ->assertJsonPath('data.lock_version', 2);

    expect(E::champs($this->org, $futur))->toMatchArray(['ends_on' => '2026-12-20', 'version' => 1]);
});

it('liste les régimes de la juridiction du lot avec leurs durées, plafond et champs', function (): void {
    $lot = L::lot($this->org);
    $this->actingAs($this->titulaire);

    $reponse = $this->getJson(R::url($this->org, "/regimes?unit={$lot->id}"))->assertOk();
    $regimes = collect($reponse->json('data'))->keyBy('key');

    expect($regimes->keys()->all())->toContain('fr.residential.unfurnished', 'fr.residential.furnished', 'fr.residential.mobility')
        ->and($regimes->pluck('jurisdiction')->unique()->all())->toBe(['FR'])
        ->and($regimes->pluck('currency')->unique()->all())->toBe(['EUR']);

    $vide = $regimes['fr.residential.unfurnished'];
    expect($vide['label'])->toBe('Logement vide (loi du 6 juillet 1989)')
        ->and($vide['defaults'])->toBe([
            'duration_months' => 36,
            'minimum_duration_months' => 36,
            'maximum_duration_months' => null,
            'tacit_renewal' => true,
            'renewal_months' => 36,
            'deposit_cap_months' => 1,
            'tenant_notice_months' => 3,
            'landlord_notice_months' => 6,
        ])
        ->and(collect($vide['jurisdiction_data_fields'])->firstWhere('key', 'tense_zone'))->toBe(['key' => 'tense_zone', 'type' => 'boolean', 'options' => []])
        ->and(collect($vide['jurisdiction_data_fields'])->firstWhere('key', 'energy_class')['options'])->toBe(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
        ->and($regimes['fr.residential.mobility']['defaults']['maximum_duration_months'])->toBe(10);
});

it('répond unit_not_found, jurisdiction_unsupported et 422 sur la lecture des régimes', function (): void {
    $this->actingAs($this->titulaire);
    $etranger = L::lot(L::organisation());

    $this->getJson(R::url($this->org, "/regimes?unit={$etranger->id}"))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    $this->getJson(R::url($this->org, '/regimes?unit='.fake()->uuid()))->assertNotFound()->assertJsonPath('code', 'unit_not_found');
    $this->getJson(R::url($this->org, '/regimes?unit='.U::lotDuPays($this->org, 'BE')->id))->assertUnprocessable()->assertJsonPath('code', 'jurisdiction_unsupported');
    $this->getJson(R::url($this->org, '/regimes'))->assertUnprocessable()->assertJsonValidationErrors('unit');
    $this->getJson(R::url($this->org, '/regimes?unit=pas-un-uuid'))->assertUnprocessable()->assertJsonValidationErrors('unit');
});

it('ouvre la lecture des régimes à tout rôle membre, refuse sans jeton et hors de l\'organisation', function (): void {
    $lot = L::lot($this->org);
    $url = R::url($this->org, "/regimes?unit={$lot->id}");

    $this->getJson($url)->assertUnauthorized();

    R::changerDeCompte($this, L::membre($this->org, MemberRole::Accountant));
    $this->getJson($url)->assertOk()->assertJsonCount(4, 'data');

    R::changerDeCompte($this, L::titulaire(L::organisation()));
    $this->getJson($url)->assertNotFound()->assertJsonPath('code', 'organization_not_found');
});

it('parcourt le cycle complet : créer, signer, colocataire, annexe, loyer, préavis, résiliation, lot libre puis relouable', function (): void {
    $lot = L::lot($this->org);
    $annexe = L::lot($this->org);
    $this->actingAs($this->titulaire);
    $colocataire = L::partie($this->org);
    $racine = fn (string $chemin = ''): string => R::url($this->org, $chemin);

    $id = (string) $this->postJson($racine(), D::payload($lot, L::partie($this->org), ['starts_on' => '2025-03-01']))->assertCreated()->json('data.id');
    $this->postJson($racine("/{$id}/sign"), ['signed_on' => '2025-02-20', 'lock_version' => 1])->assertOk()->assertJsonPath('data.lock_version', 2);
    $this->postJson($racine("/{$id}/parties"), ['lock_version' => 2, 'party_id' => $colocataire->id, 'role' => 'tenant'])->assertCreated()
        ->assertJsonPath('data.lock_version', 3)
        ->assertJsonCount(2, 'data.parties');
    $this->postJson($racine("/{$id}/units"), ['lock_version' => 3, 'unit_id' => $annexe->id, 'is_main' => false, 'valid_from' => '2026-11-16'])->assertCreated()
        ->assertJsonPath('data.lock_version', 4)
        ->assertJsonCount(2, 'data.units');
    $this->postJson($racine("/{$id}/terms/revise"), ['lock_version' => 4, 'effective_on' => '2026-11-01', 'reason' => 'revision', 'changes' => [T::changer('rent', 67000)]])->assertOk()
        ->assertJsonPath('meta.lock_version', 5);

    $occupe = fn (string $unite, string $date): bool => ! $this->getJson($racine("/occupancy?units[]={$unite}&date={$date}"))->assertOk()->json('data.0.vacant');
    $second = (string) $this->postJson($racine(), D::payload($lot, L::partie($this->org), ['starts_on' => '2027-03-01']))->assertCreated()->json('data.id');
    $this->postJson($racine("/{$second}/sign"), ['signed_on' => '2026-11-16', 'lock_version' => 1])->assertConflict()->assertJsonPath('code', 'lease_overlap');

    $this->postJson($racine("/{$id}/notice"), ['lock_version' => 5, 'notice_given_by' => 'tenant', 'notice_received_on' => '2026-11-10', 'termination_reason' => 'Mutation'])->assertOk()
        ->assertJsonPath('data.notice.departure_on', '2027-02-10');
    expect($occupe($lot->id, '2027-02-09'))->toBeTrue()->and($occupe($lot->id, '2027-02-10'))->toBeFalse()->and($occupe($lot->id, '2027-03-01'))->toBeFalse();

    $this->postJson($racine("/{$id}/terminate"), ['lock_version' => 6])->assertOk()
        ->assertJsonPath('data.status', 'terminated')
        ->assertJsonPath('data.end_date', '2027-02-09')
        ->assertJsonPath('data.lock_version', 7);

    expect($occupe($lot->id, '2027-02-09'))->toBeTrue()
        ->and($occupe($lot->id, '2027-02-10'))->toBeFalse()
        ->and($occupe($annexe->id, '2027-02-10'))->toBeFalse();

    $this->postJson($racine("/{$second}/sign"), ['signed_on' => '2026-11-16', 'lock_version' => 1])->assertOk()->assertJsonPath('data.status', 'signed');
    expect($occupe($lot->id, '2027-03-01'))->toBeTrue()
        ->and($this->getJson($racine("/occupancy?units[]={$lot->id}&date=2027-03-01"))->json('data.0.lease.id'))->toBe($second);
});
