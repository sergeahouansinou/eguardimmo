<?php

declare(strict_types=1);

use App\Modules\Catalog\Models\Term;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseTerm;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseTermsReviseContext as T;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->bail = T::bail($this->org);
    $this->loyer = T::ligne($this->org, $this->bail, 'rent', 65000);
    $this->actingAs($this->titulaire);
    $this->reviser = fn (string $effet = '2026-07-01', ?array $changements = null, array $surcharges = []) => $this->postJson(
        T::url($this->org, $this->bail),
        T::corps($this->bail, $effet, $changements ?? [T::changer('rent', 66500)], $surcharges),
    );
    $this->intact = function (): void {
        expect(T::historique($this->org, $this->bail, 'rent'))->toBe([['from' => '2026-01-01', 'to' => null, 'amount' => 65000]])
            ->and(L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id)->lock_version))->toBe(1);
    };
});

it('refuse une ligne programmée sur la période, même liée comme remplaçante', function (): void {
    T::ligne($this->org, $this->bail, 'rent', 70000, ['valid_from' => '2026-09-01']);

    ($this->reviser)()->assertConflict()->assertJsonPath('code', 'lease_term_overlap');

    expect(L::dans($this->org, fn () => LeaseTerm::query()->findOrFail($this->loyer->id)->valid_to))->toBeNull();
});

it('refuse de réviser une ligne qui a déjà une remplaçante programmée', function (): void {
    $borne = T::ligne($this->org, $this->bail, 'rent_supplement', 5000, ['valid_to' => '2026-12-01']);
    T::ligne($this->org, $this->bail, 'rent_supplement', 4000, ['valid_from' => '2026-12-01', 'replaces_id' => $borne->id]);

    ($this->reviser)('2026-06-01', [T::changer('rent_supplement', 6000)], ['reason' => 'amendment'])
        ->assertConflict()->assertJsonPath('code', 'lease_term_overlap');
});

it('refuse une révision le jour même où la ligne en vigueur commence', function (): void {
    ($this->reviser)('2026-01-01')->assertConflict()->assertJsonPath('code', 'lease_term_overlap');
    ($this->intact)();
});

it('refuse le dépôt de garantie après la signature', function (): void {
    T::ligne($this->org, $this->bail, 'deposit', 65000);

    ($this->reviser)('2026-07-01', [T::changer('deposit', 70000)], ['reason' => 'amendment'])
        ->assertConflict()->assertJsonPath('code', 'lease_deposit_locked');
    ($this->intact)();
});

it('refuse une date d\'effet hors du bail', function (string $effet, array $bail = []): void {
    L::dans($this->org, fn () => Lease::query()->whereKey($this->bail->id)->update($bail));

    ($this->reviser)($effet)->assertUnprocessable()->assertJsonPath('code', 'lease_period_invalid');
    ($this->intact)();
})->with([
    'avant le début' => ['2024-12-31'],
    'à la fin exclue' => ['2029-01-01'],
    'après la fin' => ['2029-06-01'],
    'à la date de départ du préavis' => ['2026-09-01', ['notice_received_on' => '2026-03-01', 'notice_given_by' => 'tenant', 'notice_departure_on' => '2026-09-01', 'termination_reason' => 'départ']],
]);

it('accepte le premier jour utile et le dernier jour du bail', function (string $effet): void {
    T::ligne($this->org, $this->bail, 'charges_provision', 8000, ['valid_from' => '2026-01-01']);

    ($this->reviser)($effet, [T::changer('charges_provision', 9000)], ['reason' => 'amendment'])->assertOk();
})->with(['2026-01-02', '2028-12-31']);

it('refuse la révision d\'un régime sans révision', function (array $bail): void {
    L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id)->forceFill($bail)->save());
    $this->bail = L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id));

    ($this->reviser)()->assertConflict()->assertJsonPath('code', 'lease_revision_not_allowed');

    expect(T::historique($this->org, $this->bail, 'rent'))->toBe([['from' => '2026-01-01', 'to' => null, 'amount' => 65000]]);

    ($this->reviser)('2026-07-01', null, ['reason' => 'amendment'])->assertOk();
})->with([
    'bail mobilité' => [['regime_key' => 'fr.residential.mobility', 'duration_months' => 10, 'ends_on' => '2026-11-01']],
    'logement classé F' => [['jurisdiction_data' => ['energy_class' => 'F']]],
    'logement classé G' => [['jurisdiction_data' => ['energy_class' => 'G']]],
]);

it('accepte la révision d\'un logement classé E', function (): void {
    L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id)->forceFill(['jurisdiction_data' => ['energy_class' => 'E']])->save());
    $this->bail = L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id));

    ($this->reviser)()->assertOk();
});

it('n\'accepte une révision que sur une ligne indexée', function (): void {
    T::ligne($this->org, $this->bail, 'charges_provision', 8000, ['indexed' => false]);

    ($this->reviser)('2026-07-01', [T::changer('rent', 66500), T::changer('charges_provision', 9000)])
        ->assertConflict()->assertJsonPath('code', 'lease_term_not_indexed');
    ($this->intact)();

    ($this->reviser)('2026-07-01', [T::changer('charges_provision', 9000)], ['reason' => 'amendment'])->assertOk();
});

it('refuse une suppression au titre d\'une révision', function (): void {
    ($this->reviser)('2026-07-01', [['component_term_id' => L::composante('rent')->id, 'close' => true]])
        ->assertUnprocessable()->assertJsonPath('code', 'lease_component_invalid');
    ($this->intact)();
});

it('refuse une version périmée et incrémente la version à chaque révision', function (): void {
    ($this->reviser)('2026-07-01', null, ['lock_version' => 2])->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    ($this->intact)();

    ($this->reviser)()->assertOk()->assertJsonPath('meta.lock_version', 2);
    ($this->reviser)('2027-07-01', [T::changer('rent', 67000)])->assertConflict()->assertJsonPath('code', 'lease_stale_version');
    ($this->reviser)('2027-07-01', [T::changer('rent', 67000)], ['lock_version' => 2])->assertOk()->assertJsonPath('meta.lock_version', 3);
});

it('refuse un bail qui n\'est pas signé ou actif', function (LeaseStatus $statut, string $code, bool $archive = false): void {
    L::dans($this->org, fn () => Lease::query()->whereKey($this->bail->id)->update([
        'status' => $statut->value, 'archived_at' => $archive ? now() : null, 'signed_on' => $statut === LeaseStatus::Draft ? null : '2025-12-15',
    ]));

    ($this->reviser)()->assertConflict()->assertJsonPath('code', $code);
    ($this->intact)();
})->with([
    'brouillon' => [LeaseStatus::Draft, 'lease_not_signed'],
    'terminé' => [LeaseStatus::Terminated, 'lease_already_terminated'],
    'annulé' => [LeaseStatus::Cancelled, 'lease_already_terminated'],
    'archivé' => [LeaseStatus::Signed, 'lease_archived', true],
]);

it('ne voit pas le bail d\'une autre organisation', function (): void {
    $autre = L::organisation();
    $bailAutre = T::bail($autre);
    T::ligne($autre, $bailAutre, 'rent', 50000);

    $this->postJson(T::url($this->org, $bailAutre), T::corps($bailAutre, '2026-07-01', [T::changer('rent', 51000)]))
        ->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    $this->postJson(T::url($autre, $bailAutre), T::corps($bailAutre, '2026-07-01', [T::changer('rent', 51000)]))->assertNotFound();

    expect(T::historique($autre, $bailAutre, 'rent'))->toBe([['from' => '2026-01-01', 'to' => null, 'amount' => 50000]]);
});

it('refuse une composante d\'une autre organisation, inconnue ou absente du bail', function (): void {
    $autre = L::organisation();
    $etrangere = Term::query()->create([
        'organization_id' => $autre->id, 'vocabulary' => 'lease_component', 'key' => 'parking_autre', 'labels' => ['fr' => 'Parking'],
        'position' => 99, 'is_system' => false,
    ]);

    ($this->reviser)('2026-07-01', [['component_term_id' => $etrangere->id, 'amount' => 1000]], ['reason' => 'amendment'])
        ->assertUnprocessable()->assertJsonPath('code', 'lease_component_invalid');
    ($this->reviser)('2026-07-01', [['component_term_id' => L::terme('unit_type', 'apartment')->id, 'amount' => 1000]], ['reason' => 'amendment'])
        ->assertUnprocessable()->assertJsonPath('code', 'lease_component_invalid');
    ($this->reviser)('2026-07-01', [T::changer('charges_provision', 9000)], ['reason' => 'amendment'])
        ->assertNotFound()->assertJsonPath('code', 'lease_term_not_found');
    ($this->intact)();
});

it('valide la requête en liste blanche', function (array $surcharges, string $champ): void {
    ($this->reviser)('2026-07-01', null, $surcharges)->assertUnprocessable()->assertJsonValidationErrors($champ);
    ($this->intact)();
})->with([
    'motif initial' => [['reason' => 'initial'], 'reason'],
    'motif inconnu' => [['reason' => 'bonus'], 'reason'],
    'date invalide' => [['effective_on' => '01/07/2026'], 'effective_on'],
    'version absente' => [['lock_version' => null], 'lock_version'],
    'aucun changement' => [['changes' => []], 'changes'],
    'montant décimal' => [['changes' => [['component_term_id' => '01934f6e-0000-7000-8000-00000000000a', 'amount' => 12.5]]], 'changes.0.amount'],
    'montant négatif' => [['changes' => [['component_term_id' => '01934f6e-0000-7000-8000-00000000000a', 'amount' => -1]]], 'changes.0.amount'],
    'montant absent' => [['changes' => [['component_term_id' => '01934f6e-0000-7000-8000-00000000000a']]], 'changes.0.amount'],
    'TVA hors bornes' => [['changes' => [['component_term_id' => '01934f6e-0000-7000-8000-00000000000a', 'amount' => 1, 'vat_bp' => 10001]]], 'changes.0.vat_bp'],
    'identifiant invalide' => [['changes' => [['component_term_id' => 'loyer', 'amount' => 1]]], 'changes.0.component_term_id'],
    'suppression avec montant' => [['changes' => [['component_term_id' => '01934f6e-0000-7000-8000-00000000000a', 'close' => true, 'amount' => 1]]], 'changes.0.close'],
]);

it('refuse deux fois la même composante', function (): void {
    $id = L::composante('rent')->id;

    ($this->reviser)('2026-07-01', [['component_term_id' => $id, 'amount' => 1], ['component_term_id' => $id, 'amount' => 2]])
        ->assertUnprocessable()->assertJsonValidationErrors('changes.0.component_term_id');
    ($this->intact)();
});

it('exige un compte authentifié', function (): void {
    auth()->forgetGuards();

    $this->postJson(T::url($this->org, $this->bail), T::corps($this->bail, '2026-07-01', [T::changer('rent', 66500)]))->assertUnauthorized();
});
