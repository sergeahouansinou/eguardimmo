<?php

declare(strict_types=1);

use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Support\FactsReader;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Reporting\ReportingContext as R;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = R::agence($this);
});

it('un loyer appelé et non payé figure en impayé avec le locataire et le bail, sans toucher au solde du mandant', function (): void {
    C::emises($this->org, $this->bail, $this);
    $this->travelTo(CarbonImmutable::parse('2026-12-10 10:00:00'));

    foreach (F::moisAClore($this->org) as $mois) {
        F::envoyer($this, 'POST', "/api/v1/org/{$this->org->id}/accounting/periods/close", ['month' => $mois])->assertSuccessful();
    }

    $id = R::rapport($this, ['options' => ['reminder_detail' => true, 'receipts_attached' => true]]);
    $rapport = $this->getJson(R::url($this->org, "/management-reports/{$id}"))->assertOk()->json('data');
    $parGenre = collect($rapport['lines'])->groupBy('kind')->map(fn ($g) => $g->sum('amount.amount'));

    expect($parGenre->get('rent_called'))->toBe(70000)
        ->and($parGenre->get('arrears'))->toBe(70000)
        ->and($parGenre->has('rent_collected'))->toBeFalse()
        ->and($rapport['totals']['collected']['amount'])->toBe(0)
        ->and($rapport['totals']['closing_balance']['amount'])->toBe(0)
        ->and($rapport['units'][0]['tenants'])->toHaveCount(1)->and($rapport['units'][0]['lease_reference'])->toBe($this->bail->reference)
        ->and($rapport['options']['reminder_detail'])->toBeTrue();
});

it('sans la section impayés, aucune ligne d\'impayé ni de locataire détaillé n\'est figée', function (): void {
    C::emises($this->org, $this->bail, $this);
    $this->travelTo(CarbonImmutable::parse('2026-12-10 10:00:00'));

    foreach (F::moisAClore($this->org) as $mois) {
        F::envoyer($this, 'POST', "/api/v1/org/{$this->org->id}/accounting/periods/close", ['month' => $mois])->assertSuccessful();
    }

    $id = R::rapport($this, ['sections' => ['rent', 'payout']]);
    $genres = collect($this->getJson(R::url($this->org, "/management-reports/{$id}"))->json('data.lines'))->pluck('kind')->unique()->all();

    expect($genres)->not->toContain('arrears');
});

it('les lectures de faits (références d\'intervention, recouvrement, quittances) tournent sur le schéma réel', function (): void {
    $faits = app(FactsReader::class);

    $resultats = L::dans($this->org, fn () => [
        $faits->interventionReferences([(string) Str::uuid()]),
        $faits->activeRecoveryCases([$this->bail->id]),
        $faits->receipts([$this->bail->id], CarbonImmutable::parse('2026-11-01'), CarbonImmutable::parse('2026-11-30')),
        $faits->interventionReferences([]),
    ]);

    expect($resultats)->toBe([[], [], [], []]);
});

it('les quittances émises dans la période sont listées dans le compte rendu', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);

    $id = R::rapport($this);
    $recus = L::dans($this->org, fn () => ManagementReport::query()->findOrFail($id)->snapshot['receipts']);

    expect($recus)->toHaveCount(1)->and($recus[0]['lease_id'])->toBe($this->bail->id)->and($recus[0]['number'])->toStartWith('QT-2026-');
});
