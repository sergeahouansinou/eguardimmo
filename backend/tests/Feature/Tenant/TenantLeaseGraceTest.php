<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Support\GracePeriod;
use Carbon\CarbonImmutable;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    L::semer();
    $this->org = T::organisation();
});

function bailTermine(mixed $test, array $bail = [], array $ligne = []): array
{
    return T::locataire($test->org, ['status' => LeaseStatus::Terminated, 'starts_on' => '2024-01-01', 'ends_on' => '2025-03-01', ...$bail], ['valid_from' => '2024-01-01', ...$ligne]);
}

it('garde l\'accès jusqu\'à 12 mois après le dernier jour d\'occupation, inclus', function (): void {
    $moi = bailTermine($this);
    $this->travelTo(CarbonImmutable::parse('2026-02-28 09:00:00'));

    $this->actingAs($moi['user'])->getJson("/api/v1/tenant/leases/{$moi['lease']->id}")
        ->assertOk()
        ->assertJsonPath('data.end_date', '2025-02-28')
        ->assertJsonPath('data.phase', 'ended')
        ->assertJsonPath('data.access', ['until' => '2026-02-28', 'in_grace' => true]);
    T::comme($this, $moi['user'])->getJson('/api/v1/tenant/leases')->assertJsonCount(1, 'data');
});

it('refuse le jour suivant la fin de la période de grâce, en détail comme en liste', function (): void {
    $moi = bailTermine($this);
    $this->travelTo(CarbonImmutable::parse('2026-03-01 00:00:01'));

    $this->actingAs($moi['user'])->getJson("/api/v1/tenant/leases/{$moi['lease']->id}")->assertNotFound()->assertJsonPath('code', 'lease_not_found');
    T::comme($this, $moi['user'])->getJson('/api/v1/tenant/leases')->assertOk()->assertJsonCount(0, 'data');
});

it('compte la grâce depuis le départ préavisé quand il précède la fin du bail', function (): void {
    $moi = bailTermine($this, ['ends_on' => '2027-01-01', 'notice_received_on' => '2025-01-10', 'notice_departure_on' => '2025-03-01']);

    $this->travelTo(CarbonImmutable::parse('2026-02-28'));
    $this->actingAs($moi['user'])->getJson("/api/v1/tenant/leases/{$moi['lease']->id}")->assertOk();

    $this->travelTo(CarbonImmutable::parse('2026-03-01'));
    T::comme($this, $moi['user'])->getJson("/api/v1/tenant/leases/{$moi['lease']->id}")->assertNotFound();
});

it('compte la grâce d\'un colocataire sorti depuis son propre départ, le bail continuant', function (): void {
    $moi = T::locataire($this->org, ['starts_on' => '2024-01-01', 'ends_on' => '2030-01-01'], ['valid_from' => '2024-01-01', 'valid_to' => '2025-06-01']);

    $this->travelTo(CarbonImmutable::parse('2026-05-31'));
    $this->actingAs($moi['user'])->getJson("/api/v1/tenant/leases/{$moi['lease']->id}")->assertOk()->assertJsonPath('data.access', ['until' => '2026-05-31', 'in_grace' => true]);

    $this->travelTo(CarbonImmutable::parse('2026-06-01'));
    T::comme($this, $moi['user'])->getJson("/api/v1/tenant/leases/{$moi['lease']->id}")->assertNotFound();
});

it('n\'ouvre aucune grâce tant que l\'occupation n\'a pas de fin', function (): void {
    $moi = T::locataire($this->org, ['starts_on' => '2020-01-01', 'ends_on' => null], ['valid_from' => '2020-01-01']);
    $this->travelTo(CarbonImmutable::parse('2026-11-16'));

    $this->actingAs($moi['user'])->getJson("/api/v1/tenant/leases/{$moi['lease']->id}")->assertOk()->assertJsonPath('data.access', ['until' => null, 'in_grace' => false]);
});

it('applique la même règle en SQL (cutoff) et en date de fin d\'accès (until), même autour du 29 février', function (): void {
    $fins = ['2023-02-28', '2024-02-28', '2024-02-29', '2024-03-01', '2025-01-31', '2025-02-28', '2025-12-31'];
    $jours = CarbonImmutable::parse('2024-01-01')->daysUntil('2026-12-31');

    foreach ($jours as $jour) {
        $coupure = GracePeriod::cutoff($jour);

        foreach ($fins as $dernierJour) {
            expect($dernierJour >= $coupure)->toBe(GracePeriod::until($dernierJour) >= $jour->toDateString(), "{$dernierJour} au {$jour->toDateString()}");
        }
    }
});
