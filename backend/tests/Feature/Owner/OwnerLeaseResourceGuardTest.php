<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeasePhase;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Http\Resources\Owner\OwnerLeaseSummaryResource;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Support\LeaseView;
use App\Modules\Leases\Support\OwnerLeaseScope;
use App\Modules\Leases\Support\OwnerLeaseView;
use Carbon\CarbonImmutable;

it('ignore la ligne d\'un locataire dont la fiche manque au lieu de répondre 500', function (): void {
    $bail = new Lease(['starts_on' => '2026-01-01', 'ends_on' => '2029-01-01', 'status' => LeaseStatus::Signed]);
    $ligne = new LeaseParty(['party_id' => fake()->uuid(), 'role' => LeasePartyRole::Tenant, 'valid_from' => '2026-01-01']);
    $jour = CarbonImmutable::parse('2026-11-19');
    $vue = new LeaseView(lease: $bail, phase: LeasePhase::Running, today: $jour, parties: [$ligne], partyData: []);
    $resource = new OwnerLeaseSummaryResource(new OwnerLeaseView($vue, null, null, [], OwnerLeaseScope::of($bail, [], [], $jour)));

    expect($resource->toArray(request())['tenants'])->toBe([]);
});
