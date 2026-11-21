<?php

declare(strict_types=1);

use App\Modules\Charges\Events\ChargeRegularizationDue;
use App\Modules\Organizations\Enums\OrganizationKind;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Charges\ExercisesContext as E;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as R;

beforeEach(function (): void {
    C::preparer($this);
});

it('charges:verify ne signale rien sur des dépenses et un décompte émis cohérents', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    E::emettre($this, $scene, $exercice)->assertOk();

    $this->artisan('charges:verify')->expectsOutputToContain('Charges cohérentes.')->assertSuccessful();
});

it('charges:verify signale, sans corriger, un solde ou une somme de lignes qui ne concordent plus', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    $decompte = E::decomptes($scene['org'], $exercice)[0];

    L::dans($scene['org'], function () use ($decompte): void {
        DB::table('charge_statements')->where('id', $decompte['id'])->update(['balance' => 1]);
        DB::table('charge_items')->update(['amount' => 1]);
        DB::table('charge_statements')->where('id', $decompte['id'])->update(['share_total' => 5]);
    });

    $this->artisan('charges:verify')->expectsOutputToContain('[item_overshare]')->expectsOutputToContain('[statement_total_mismatch]')->expectsOutputToContain('[statement_balance_mismatch]')->assertFailed();
    expect(DB::table('charge_statements')->where('id', $decompte['id'])->value('balance'))->toBe(1)
        ->and(DB::table('audit_logs')->where('action', 'charges.anomaly.detected')->count())->toBe(3);
});

it('charges:verify signale un cumul de source au-delà de la part récupérable', function (): void {
    ['scene' => $scene] = E::calcule($this, 8000);

    L::dans($scene['org'], fn () => DB::table('charge_item_sources')->update(['amount' => 99000000]));

    $this->artisan('charges:verify')->expectsOutputToContain('[source_overcap]')->assertFailed();
});

it('charges:verify signale un décompte émis sans effet dans le compte du locataire', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    E::emettre($this, $scene, $exercice)->assertOk();

    L::dans($scene['org'], function (): void {
        foreach (DB::select("select name from sqlite_master where type = 'trigger' and tbl_name = 'rent_adjustments'") as $declencheur) {
            DB::unprepared("drop trigger {$declencheur->name}");
        }

        DB::table('rent_adjustments')->delete();
    });

    $this->artisan('charges:verify')->expectsOutputToContain('[statement_effect_missing]')->assertFailed();
});

it('charges:verify signale une dépense dont l\'écriture a disparu', function (): void {
    ['scene' => $scene] = E::calcule($this, 8000);

    L::dans($scene['org'], fn () => DB::table('expenses')->update(['ledger_entry_id' => null]));

    $this->artisan('charges:verify')->expectsOutputToContain('[expense_entry_mismatch]')->assertFailed();
});

it('charges:flag-due signale une fois par bail et par année la régularisation en retard', function (): void {
    Event::fake([ChargeRegularizationDue::class]);
    $scene = E::scene($this);
    config(['charges.due_after_months' => 0]);
    $this->travelTo('2028-06-01');

    $this->artisan('charges:flag-due')->expectsOutputToContain('2 régularisation(s) signalée(s).')->assertSuccessful();
    $this->artisan('charges:flag-due')->expectsOutputToContain('0 régularisation(s) signalée(s).')->assertSuccessful();

    Event::assertDispatchedTimes(ChargeRegularizationDue::class, 2);
    Event::assertDispatched(ChargeRegularizationDue::class, fn (ChargeRegularizationDue $e): bool => $e->leaseId === $scene['lease']->id && $e->organizationId === $scene['org']->id && $e->year === 2026);
    Event::assertDispatched(ChargeRegularizationDue::class, fn (ChargeRegularizationDue $e): bool => $e->year === 2027);
});

it('charges:flag-due ne signale pas une année couverte par un décompte émis, ni un délai non échu, ni un bail sans provision', function (): void {
    Event::fake([ChargeRegularizationDue::class]);
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    E::emettre($this, $scene, $exercice)->assertOk();
    config(['charges.due_after_months' => 0]);
    $this->travelTo('2027-06-01');

    $this->artisan('charges:flag-due')->expectsOutputToContain('0 régularisation(s) signalée(s).')->assertSuccessful();

    config(['charges.due_after_months' => 9]);
    $this->travelTo('2028-02-01');
    $this->artisan('charges:flag-due')->expectsOutputToContain('0 régularisation(s) signalée(s).')->assertSuccessful();

    $sansProvision = R::organisation(OrganizationKind::Individual, 'M. Durand');
    R::bail($sansProvision, [], 65000, 0);
    config(['charges.due_after_months' => 0]);
    $this->artisan('charges:flag-due')->assertSuccessful();

    Event::assertNotDispatched(ChargeRegularizationDue::class, fn (ChargeRegularizationDue $e): bool => $e->organizationId === $sansProvision->id);
    Event::assertDispatchedTimes(ChargeRegularizationDue::class, 1);
});

it('planifie les deux contrôles chaque jour', function (): void {
    $commandes = collect(app(Schedule::class)->events())->map(fn ($e): string => (string) $e->command);

    expect($commandes->contains(fn (string $c): bool => str_contains($c, 'charges:verify')))->toBeTrue()
        ->and($commandes->contains(fn (string $c): bool => str_contains($c, 'charges:flag-due')))->toBeTrue();
});
