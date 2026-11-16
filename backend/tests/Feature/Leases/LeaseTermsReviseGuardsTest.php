<?php

declare(strict_types=1);

use App\Modules\Leases\Models\Lease;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeaseTermsReviseContext as T;

beforeEach(function (): void {
    L::semer();
    $this->org = L::organisation();
    $this->titulaire = L::titulaire($this->org);
    $this->bail = T::bail($this->org);
    $this->loyer = T::ligne($this->org, $this->bail, 'rent', 65000);
    $this->actingAs($this->titulaire);
    $this->reviser = fn (string $effet, array $changements, array $surcharges = []) => $this->postJson(
        T::url($this->org, $this->bail),
        T::corps($this->bail, $effet, $changements, $surcharges),
    );
    $this->intact = function (): void {
        expect(T::historique($this->org, $this->bail, 'rent'))->toBe([['from' => '2026-01-01', 'to' => null, 'amount' => 65000]])
            ->and(L::dans($this->org, fn () => Lease::query()->findOrFail($this->bail->id)->lock_version))->toBe(1);
    };
});

it('refuse une révision avant la date de la prochaine révision du régime', function (string $effet): void {
    ($this->reviser)($effet, [T::changer('rent', 66500)])
        ->assertConflict()->assertJsonPath('code', 'lease_revision_too_early');
    ($this->intact)();
})->with(['2025-06-01', '2025-12-31']);

it('accepte la révision le jour de son premier anniversaire', function (): void {
    ($this->reviser)('2026-01-02', [T::changer('rent', 66500)])->assertOk();
});

it('ne bloque pas un avenant ou une correction avant la date de révision', function (string $motif): void {
    T::ligne($this->org, $this->bail, 'charges_provision', 8000, ['valid_from' => '2025-01-01', 'indexed' => false]);

    ($this->reviser)('2025-06-01', [T::changer('charges_provision', 9000)], ['reason' => $motif])->assertOk();
})->with(['amendment', 'correction']);

it('refuse de fermer la ligne de loyer d\'un bail signé sans la remplacer', function (string $motif): void {
    ($this->reviser)('2026-07-01', [['component_term_id' => L::composante('rent')->id, 'close' => true]], ['reason' => $motif])
        ->assertUnprocessable()->assertJsonPath('code', 'lease_no_rent');
    ($this->intact)();
})->with(['amendment', 'correction']);

it('autorise de fermer une autre composante que le loyer', function (): void {
    T::ligne($this->org, $this->bail, 'charges_provision', 8000);

    ($this->reviser)('2026-07-01', [['component_term_id' => L::composante('charges_provision')->id, 'close' => true]], ['reason' => 'amendment'])->assertOk();

    expect(T::historique($this->org, $this->bail, 'rent'))->toBe([['from' => '2026-01-01', 'to' => null, 'amount' => 65000]]);
});
