<?php

declare(strict_types=1);

require_once __DIR__.'/helpers.php';

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\CollectionComponent;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Money\Currency;
use Money\Money;

/**
 * @param  array<string, int>  $composants  rôle => montant
 */
function appelDeLoyer(object $test, string $echeance, array $composants, string $date = '2026-11-01'): void
{
    $total = array_sum($composants);
    $lignes = [LineData::debit(AccountRole::TenantReceivable, Money::EUR($total), $test->bail, $test->locataire, $test->lot, ItemType::Installment, $echeance)];

    foreach ($composants as $role => $montant) {
        $lignes[] = LineData::credit(AccountRole::from($role), Money::EUR($montant), $test->bail, $test->locataire, $test->lot);
    }

    comptaPoster($test->org, new EntryData(Journal::Rent, CarbonImmutable::parse($date), 'Appel', SourceType::Installment, $echeance, 'appel:'.$echeance, $lignes));
}

function encaissement(object $test, string $cle, int $montant, string $date, ?string $echeance): object
{
    return comptaPoster($test->org, new EntryData(Journal::Bank, CarbonImmutable::parse($date), 'Encaissement', SourceType::Payment, (string) Str::uuid7(), $cle, [
        LineData::debit(AccountRole::Bank, Money::EUR($montant)),
        LineData::credit(AccountRole::TenantReceivable, Money::EUR($montant), $test->bail, $test->locataire, $echeance === null ? null : $test->lot, $echeance === null ? null : ItemType::Installment, $echeance),
    ]));
}

/**
 * @return array<string, int> "mois|composant" => montant
 */
function ventilation(object $test, string $du = '2026-01-01', string $au = '2026-12-31', ?array $lots = null): array
{
    $lignes = comptaDans($test->org, fn () => app(LedgerAggregates::class)->collectedByComponent(new Currency('EUR'), CarbonImmutable::parse($du), CarbonImmutable::parse($au), $lots));
    $sortie = [];

    foreach ($lignes as $l) {
        $sortie[$l->month.'|'.$l->component->value] = (int) $l->amount->getAmount();
    }

    return $sortie;
}

beforeEach(function (): void {
    $this->org = comptaOrganisation();
    $this->bail = (string) Str::uuid7();
    $this->locataire = (string) Str::uuid7();
    $this->lot = (string) Str::uuid7();
    $this->echeance = (string) Str::uuid7();
});

it('ventile un encaissement partiel au prorata de l\'appel, plus fort reste, somme exacte', function (): void {
    appelDeLoyer($this, $this->echeance, ['rent_revenue' => 65000, 'charges_recovered' => 5000]);
    encaissement($this, 'p-nov', 30000, '2026-11-10', $this->echeance);
    encaissement($this, 'p-dec', 40000, '2026-12-10', $this->echeance);

    expect(ventilation($this))->toBe([
        '2026-11|charges' => 2143,
        '2026-11|rent' => 27857,
        '2026-12|charges' => 2857,
        '2026-12|rent' => 37143,
    ]);
});

it('départage les restes égaux dans l\'ordre loyer, charges, TVA', function (): void {
    appelDeLoyer($this, $this->echeance, ['rent_revenue' => 1000, 'charges_recovered' => 1000, 'vat_collected' => 1000]);
    encaissement($this, 'p-1', 100, '2026-11-10', $this->echeance);

    expect(ventilation($this))->toBe(['2026-11|charges' => 33, '2026-11|rent' => 34, '2026-11|vat' => 33]);
});

it('compte une avance entière à sa réception et ignore son imputation sur une échéance', function (): void {
    encaissement($this, 'avance', 10000, '2026-10-20', null);
    appelDeLoyer($this, $this->echeance, ['rent_revenue' => 65000, 'charges_recovered' => 5000], '2026-11-01');
    comptaPoster($this->org, new EntryData(Journal::Adjustments, CarbonImmutable::parse('2026-11-02'), 'Imputation', SourceType::Payment, (string) Str::uuid7(), 'imputation', [
        LineData::debit(AccountRole::TenantReceivable, Money::EUR(10000), $this->bail, $this->locataire, $this->lot),
        LineData::credit(AccountRole::TenantReceivable, Money::EUR(10000), $this->bail, $this->locataire, $this->lot, ItemType::Installment, $this->echeance),
    ]));

    expect(ventilation($this))->toBe(['2026-10|advance' => 10000]);
});

it('déduit la contrepassation d\'un encaissement dans le mois de la contrepassation', function (): void {
    appelDeLoyer($this, $this->echeance, ['rent_revenue' => 65000, 'charges_recovered' => 5000]);
    $paiement = encaissement($this, 'p-nov', 70000, '2026-11-10', $this->echeance);
    comptaDans($this->org, fn () => app(Ledger::class)->reverse($paiement->id, CarbonImmutable::parse('2026-12-05')));

    expect(ventilation($this))->toBe([
        '2026-11|charges' => 5000, '2026-11|rent' => 65000,
        '2026-12|charges' => -5000, '2026-12|rent' => -65000,
    ])->and(ventilation($this, '2026-11-01', '2026-11-30'))->toBe(['2026-11|charges' => 5000, '2026-11|rent' => 65000]);
});

it('range un encaissement sans appel lisible dans « non résolu », jamais dans le loyer', function (): void {
    encaissement($this, 'p-orphelin', 8000, '2026-11-10', (string) Str::uuid7());

    expect(ventilation($this))->toBe(['2026-11|unresolved' => 8000]);
});

it('ne lit que les bornes demandées, dernier jour inclus, et filtre par lot', function (): void {
    appelDeLoyer($this, $this->echeance, ['rent_revenue' => 1000]);
    encaissement($this, 'p-31', 400, '2026-12-31', $this->echeance);
    encaissement($this, 'p-01', 600, '2027-01-01', $this->echeance);

    expect(ventilation($this, '2026-01-01', '2026-12-31'))->toBe(['2026-12|rent' => 400])
        ->and(ventilation($this, '2027-01-01', '2027-12-31'))->toBe(['2027-01|rent' => 600])
        ->and(ventilation($this, '2026-01-01', '2026-12-31', [(string) Str::uuid7()]))->toBe([])
        ->and(ventilation($this, '2026-01-01', '2026-12-31', []))->toBe([]);
});

it('ne compte pas un encaissement sans débit de banque ni de caisse (dépôt, imputation)', function (): void {
    appelDeLoyer($this, $this->echeance, ['rent_revenue' => 1000]);
    comptaPoster($this->org, new EntryData(Journal::Adjustments, CarbonImmutable::parse('2026-11-10'), 'Avoir', SourceType::Payment, (string) Str::uuid7(), 'sans-banque', [
        LineData::debit(AccountRole::CustomerReceivable, Money::EUR(500)),
        LineData::credit(AccountRole::TenantReceivable, Money::EUR(500), $this->bail, $this->locataire, $this->lot, ItemType::Installment, $this->echeance),
    ]));

    expect(ventilation($this))->toBe([]);
});

it('expose le composant avance sous son type', function (): void {
    expect(CollectionComponent::from('advance'))->toBe(CollectionComponent::Advance);
});
