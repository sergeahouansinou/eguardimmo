<?php

declare(strict_types=1);

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Unit;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as LR;
use Tests\Feature\Owner\OwnerReadContext as R;
use Tests\Feature\Owner\OwnerReportingContext as X;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Reporting\ReportingContext as RP;

it('ne montre pas le retard du locataire arrivé après la fin de la couverture du mandant', function (): void {
    ['org' => $org, 'bail' => $ancien, 'mandant' => $mandant] = RP::agence($this);
    $awa = X::rattacher($org, $mandant);
    $lot = L::dans($org, fn () => LeaseUnit::query()->where('lease_id', $ancien->id)->firstOrFail()->unit_id);

    L::dans($org, fn () => Lease::query()->whereKey($ancien->id)->update(['ends_on' => '2026-11-15']));
    L::dans($org, fn () => LeaseUnit::query()->where('lease_id', $ancien->id)->update(['valid_to' => '2026-11-15']));
    L::dans($org, fn () => MandateUnit::query()->where('unit_id', $lot)->update(['valid_to' => '2026-11-15']));
    C::emises($org, $ancien, $this);

    $nouveau = LR::bailSigne($org, ['starts_on' => '2026-11-15', 'ends_on' => '2029-01-01']);
    LR::occuper($org, $nouveau, L::dans($org, fn () => Unit::query()->findOrFail($lot)), ['valid_from' => '2026-11-15']);
    LR::lier($org, $nouveau, L::dans($org, fn () => Party::factory()->create()), ['valid_from' => '2026-11-15']);
    LR::terme($org, $nouveau, 'rent', ['amount' => Money::EUR(123400), 'valid_from' => '2026-11-15']);
    C::emises($org, $nouveau, $this);

    $reponse = R::lire($this, $awa, '/rent/2026-11')->assertOk();
    $montant = $reponse->json('data.mandants.0.units.0.arrears.amount');

    expect($montant)->not->toBeNull()->and($montant)->not->toBe(C::du($org, $nouveau))->and(C::du($org, $nouveau))->toBeGreaterThan(0);
});
