<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\TermChangeReason;
use App\Modules\Leases\Models\Lease;
use App\Modules\Parties\Models\ContactPoint;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use Carbon\CarbonImmutable;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs($this->titulaire);
});

/**
 * @return array{bail: Lease, lot: Unit, annexe: Unit, locataire: Party, parti: Party, garant: Party}
 */
function leaseReadBailComplet(object $test): array
{
    $bail = R::bailSigne($test->org, ['reference' => 'BL-2026-0001', 'starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', 'note' => 'Clés remises']);
    $lot = L::lot($test->org);
    $annexe = L::lot($test->org);
    $locataire = L::partie($test->org);
    $parti = L::partie($test->org);
    $garant = L::partie($test->org);

    R::occuper($test->org, $bail, $lot);
    R::occuper($test->org, $bail, $annexe, ['is_main' => false, 'valid_to' => '2026-06-01']);
    R::lier($test->org, $bail, $locataire);
    R::lier($test->org, $bail, $parti, ['valid_to' => '2026-09-01']);
    R::lier($test->org, $bail, $garant, [
        'role' => LeasePartyRole::Guarantor,
        'guarantees_party_id' => $locataire->id,
        'guarantee_limit_amount' => Money::EUR(300000),
        'guarantee_ends_on' => '2029-01-01',
    ]);

    return compact('bail', 'lot', 'annexe', 'locataire', 'parti', 'garant');
}

it('détaille un bail avec lots, parties, lignes en vigueur et phase du jour', function (): void {
    ['bail' => $bail, 'lot' => $lot, 'annexe' => $annexe, 'locataire' => $locataire, 'garant' => $garant] = leaseReadBailComplet($this);
    $ancien = R::terme($this->org, $bail, 'rent', [...R::loyer(60000), 'valid_to' => '2026-07-01']);
    $loyer = R::terme($this->org, $bail, 'rent', [...R::loyer(65000), 'valid_from' => '2026-07-01', 'reason' => TermChangeReason::Revision, 'replaces_id' => $ancien->id, 'vat_bp' => 1000]);
    R::terme($this->org, $bail, 'charges_provision', [...R::loyer(8000), 'indexed' => false]);
    R::terme($this->org, $bail, 'rent_supplement', [...R::loyer(5000), 'valid_from' => '2027-01-01']);

    $reponse = $this->getJson(R::url($this->org, "/{$bail->id}"))->assertOk();

    $reponse
        ->assertJsonPath('data.id', $bail->id)
        ->assertJsonPath('data.phase', 'running')
        ->assertJsonPath('data.end_date', '2028-12-31')
        ->assertJsonPath('data.lock_version', 1)
        ->assertJsonPath('data.signed_on', '2025-12-15')
        ->assertJsonPath('data.due_day', 5)
        ->assertJsonPath('data.note', 'Clés remises')
        ->assertJsonPath('data.notice', null)
        ->assertJsonPath('data.main_unit.id', $lot->id)
        ->assertJsonPath('data.units.1.unit.id', $annexe->id)
        ->assertJsonPath('data.units.1.is_main', false)
        ->assertJsonPath('data.units.1.end_date', '2026-05-31')
        ->assertJsonPath('data.parties.2.role', 'guarantor')
        ->assertJsonPath('data.parties.2.party.id', $garant->id)
        ->assertJsonPath('data.parties.2.guarantees_party_id', $locataire->id)
        ->assertJsonPath('data.parties.2.guarantee.limit.amount', 300000)
        ->assertJsonPath('data.parties.2.guarantee.limit.currency', 'EUR')
        ->assertJsonPath('data.parties.1.end_date', '2026-08-31');

    expect($reponse->json('data.units'))->toHaveCount(2)
        ->and($reponse->json('data.parties'))->toHaveCount(3)
        ->and($reponse->json('data.tenants'))->toHaveCount(1)
        ->and($reponse->json('data.terms'))->toHaveCount(2)
        ->and(collect($reponse->json('data.terms'))->pluck('id')->contains($ancien->id))->toBeFalse()
        ->and($reponse->json('data.terms.1.id'))->toBe($loyer->id)
        ->and($reponse->json('data.terms.1.component.key'))->toBe('rent')
        ->and($reponse->json('data.terms.1.component.semantic_key'))->toBe('rent')
        ->and($reponse->json('data.terms.1.amount'))->toBe(['amount' => 65000, 'currency' => 'EUR'])
        ->and($reponse->json('data.terms.1.vat_bp'))->toBe(1000)
        ->and($reponse->json('data.terms.1.end_date'))->toBeNull()
        ->and($reponse->json('data.terms.1.in_force'))->toBeTrue()
        ->and($reponse->json('data.terms.0.amount'))->toBe(['amount' => 8000, 'currency' => 'EUR']);
});

it('expose le préavis et la fin inclusive d\'un bail en préavis', function (): void {
    $bail = R::bailSigne($this->org, [
        'starts_on' => '2026-01-01', 'ends_on' => '2027-02-02',
        'notice_received_on' => '2026-10-01', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2027-02-01', 'termination_reason' => 'Mutation',
    ]);

    $this->getJson(R::url($this->org, "/{$bail->id}"))->assertOk()
        ->assertJsonPath('data.phase', 'notice')
        ->assertJsonPath('data.end_date', '2027-02-01')
        ->assertJsonPath('data.notice.received_on', '2026-10-01')
        ->assertJsonPath('data.notice.given_by', 'tenant')
        ->assertJsonPath('data.notice.departure_on', '2027-02-01');
});

it('n\'expose des parties que leur nom, leur nature et leur anonymisation', function (): void {
    ['bail' => $bail, 'locataire' => $locataire] = leaseReadBailComplet($this);
    L::dans($this->org, fn () => ContactPoint::query()->create(['party_id' => $locataire->id, 'type' => 'email', 'value' => 'secret.locataire@exemple.test', 'is_primary' => true, 'primary_slot' => 1]));
    $anonyme = L::partie($this->org);
    L::dans($this->org, fn () => Party::query()->whereKey($anonyme->id)->first()?->forceFill(['display_name' => 'Partie anonymisée', 'anonymized_at' => now()])->save());
    R::lier($this->org, $bail, $anonyme, ['role' => LeasePartyRole::Occupant]);

    $reponse = $this->getJson(R::url($this->org, "/{$bail->id}"))->assertOk();
    $brut = (string) $reponse->getContent();

    expect($brut)->not->toContain('secret.locataire')
        ->not->toContain('email')
        ->not->toContain('iban')
        ->not->toContain('identifier')
        ->and(array_keys($reponse->json('data.parties.0.party')))->toBe(['id', 'display_name', 'kind', 'is_anonymized'])
        ->and($reponse->json('data.parties.0.party.display_name'))->toBe($locataire->display_name)
        ->and($reponse->json('data.parties.3.party.is_anonymized'))->toBeTrue()
        ->and($reponse->json('data.parties.3.party.display_name'))->toBe('Partie anonymisée');
});

it('liste tout l\'historique des composantes, lignes fermées et futures comprises', function (): void {
    $bail = R::bailSigne($this->org);
    $autre = R::bailSigne($this->org);
    $ancien = R::terme($this->org, $bail, 'rent', [...R::loyer(60000), 'valid_to' => '2026-07-01']);
    $courant = R::terme($this->org, $bail, 'rent', [...R::loyer(65000), 'valid_from' => '2026-07-01', 'replaces_id' => $ancien->id, 'reason' => TermChangeReason::Revision]);
    $futur = R::terme($this->org, $bail, 'charges_provision', [...R::loyer(8000), 'valid_from' => '2027-01-01']);
    R::terme($this->org, $autre, 'rent', R::loyer(99900));

    $reponse = $this->getJson(R::url($this->org, "/{$bail->id}/terms"))->assertOk();

    expect(collect($reponse->json('data'))->pluck('id')->all())->toBe([$ancien->id, $courant->id, $futur->id])
        ->and(collect($reponse->json('data'))->pluck('in_force')->all())->toBe([false, true, false])
        ->and($reponse->json('data.0.end_date'))->toBe('2026-06-30')
        ->and($reponse->json('data.0.valid_from'))->toBe('2026-01-01')
        ->and($reponse->json('data.0.amount'))->toBe(['amount' => 60000, 'currency' => 'EUR'])
        ->and($reponse->json('data.1.replaces_id'))->toBe($ancien->id)
        ->and($reponse->json('data.1.reason'))->toBe('revision')
        ->and($reponse->json('data.2.component.key'))->toBe('charges_provision');
});

it('renvoie une liste vide pour un bail sans composante', function (): void {
    $bail = R::bailSigne($this->org);

    $this->getJson(R::url($this->org, "/{$bail->id}/terms"))->assertOk()->assertExactJson(['data' => []]);
});

it('détaille les lignes en vigueur au début d\'un brouillon qui démarre dans le futur', function (): void {
    $bail = L::bail($this->org, ['starts_on' => '2027-03-01', 'ends_on' => null]);
    $loyer = R::terme($this->org, $bail, 'rent', [...R::loyer(65000), 'valid_from' => '2027-03-01']);
    R::terme($this->org, $bail, 'charges_provision', [...R::loyer(8000), 'valid_from' => '2027-03-01']);
    R::terme($this->org, $bail, 'rent_supplement', [...R::loyer(5000), 'valid_from' => '2027-09-01']);

    $reponse = $this->getJson(R::url($this->org, "/{$bail->id}"))->assertOk()->assertJsonPath('data.status', 'draft');

    expect($reponse->json('data.terms'))->toHaveCount(2)
        ->and(collect($reponse->json('data.terms'))->pluck('id')->contains($loyer->id))->toBeTrue()
        ->and(collect($reponse->json('data.terms'))->pluck('in_force')->all())->toBe([true, true])
        ->and(collect($reponse->json('data.terms'))->pluck('component.key')->sort()->values()->all())->toBe(['charges_provision', 'rent']);
});
