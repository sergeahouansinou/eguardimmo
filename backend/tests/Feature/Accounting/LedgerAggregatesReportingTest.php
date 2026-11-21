<?php

declare(strict_types=1);

require_once __DIR__.'/helpers.php';

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Money\Currency;
use Money\Money;

function jour(string $date): CarbonImmutable
{
    return CarbonImmutable::parse($date);
}

/**
 * @param  list<LineData>  $lignes
 */
function ecriture(string $cle, SourceType $source, string $date, array $lignes, ?string $sourceId = null, Journal $journal = Journal::Rent): EntryData
{
    return new EntryData($journal, jour($date), 'Écriture '.$cle, $source, $sourceId ?? (string) Str::uuid7(), $cle, $lignes);
}

beforeEach(function (): void {
    $this->org = comptaOrganisation();
    $this->mandant = (string) Str::uuid7();
    $this->lot = (string) Str::uuid7();
    $this->autreLot = (string) Str::uuid7();
    $this->eur = new Currency('EUR');
});

it('agrège les mouvements par compte, lot, mois et source, sans mélanger les périodes', function (): void {
    $appel = fn (string $cle, string $date, string $lot, int $montant) => comptaPoster($this->org, ecriture($cle, SourceType::Installment, $date, [
        LineData::debit(AccountRole::TenantReceivable, Money::EUR($montant), null, null, $lot, ItemType::Installment, (string) Str::uuid7()),
        LineData::credit(AccountRole::RentRevenue, Money::EUR($montant), null, $this->mandant, $lot),
    ]));
    $appel('a-oct', '2026-10-31', $this->lot, 1000);
    $appel('a-nov-1', '2026-11-01', $this->lot, 2000);
    $appel('a-nov-2', '2026-11-30', $this->autreLot, 500);
    $appel('a-dec', '2026-12-01', $this->lot, 9000);

    $mouvements = comptaDans($this->org, fn () => app(LedgerAggregates::class)->movements([AccountRole::TenantReceivable], $this->eur, jour('2026-11-01'), jour('2026-11-30')));

    expect($mouvements)->toHaveCount(2);
    $parLot = collect($mouvements)->keyBy(fn ($m) => $m->unitId);
    expect($parLot[$this->lot]->debit->getAmount())->toBe('2000')
        ->and($parLot[$this->lot]->month)->toBe('2026-11')
        ->and($parLot[$this->lot]->source)->toBe(SourceType::Installment)
        ->and($parLot[$this->autreLot]->debit->getAmount())->toBe('500');
});

it('rattache une contrepassation au type de source de l\'écriture annulée et la déduit', function (): void {
    $entree = comptaPoster($this->org, ecriture('p-1', SourceType::Payment, '2026-11-05', [
        LineData::debit(AccountRole::Bank, Money::EUR(4000)),
        LineData::credit(AccountRole::TenantReceivable, Money::EUR(4000), null, null, $this->lot),
    ], journal: Journal::Bank));
    comptaDans($this->org, fn () => app(Ledger::class)->reverse($entree->id, jour('2026-11-20')));

    $mouvements = comptaDans($this->org, fn () => app(LedgerAggregates::class)->movements([AccountRole::TenantReceivable], $this->eur, jour('2026-11-01'), jour('2026-11-30')));

    expect($mouvements)->toHaveCount(1)
        ->and($mouvements[0]->source)->toBe(SourceType::Payment)
        ->and($mouvements[0]->credit->getAmount())->toBe('4000')
        ->and($mouvements[0]->debit->getAmount())->toBe('4000');
});

it('filtre par partie, lot et source, et renvoie vide pour une liste vide', function (): void {
    comptaPoster($this->org, ecriture('f-1', SourceType::Installment, '2026-11-02', [
        LineData::debit(AccountRole::TenantReceivable, Money::EUR(700), null, null, $this->lot),
        LineData::credit(AccountRole::RentRevenue, Money::EUR(700), null, $this->mandant, $this->lot),
    ]));
    $agregats = fn (...$p) => comptaDans($this->org, fn () => app(LedgerAggregates::class)->movements(...$p));
    $role = [AccountRole::RentRevenue];

    expect($agregats($role, $this->eur, jour('2026-11-01'), jour('2026-11-30'), [$this->mandant]))->toHaveCount(1)
        ->and($agregats($role, $this->eur, jour('2026-11-01'), jour('2026-11-30'), [(string) Str::uuid7()]))->toBe([])
        ->and($agregats($role, $this->eur, jour('2026-11-01'), jour('2026-11-30'), null, [$this->autreLot]))->toBe([])
        ->and($agregats($role, $this->eur, jour('2026-11-01'), jour('2026-11-30'), null, null, [SourceType::Payment]))->toBe([])
        ->and($agregats($role, $this->eur, jour('2026-11-01'), jour('2026-11-30'), [], null, null))->toBe([]);
});

it('ne lit jamais le grand livre d\'une autre organisation', function (): void {
    comptaPoster($this->org, ecriture('iso-1', SourceType::Installment, '2026-11-02', [
        LineData::debit(AccountRole::TenantReceivable, Money::EUR(700), null, null, $this->lot),
        LineData::credit(AccountRole::RentRevenue, Money::EUR(700), null, $this->mandant, $this->lot),
    ]));
    $autre = comptaOrganisation();

    expect(comptaDans($autre, fn () => app(LedgerAggregates::class)->movements([AccountRole::TenantReceivable], $this->eur, jour('2026-11-01'), jour('2026-11-30'))))->toBe([])
        ->and(comptaDans($autre, fn () => app(LedgerAggregates::class)->partyStatement($this->mandant, AccountRole::OwnerPayable, $this->eur, jour('2026-11-01'), jour('2026-11-30'))->lines))->toBe([])
        ->and(comptaDans($autre, fn () => app(LedgerAggregates::class)->outstandingAging($this->eur, jour('2026-12-01'))->count))->toBe(0);
});

it('relève le compte d\'une partie avec ouverture, clôture et pièce d\'origine des contrepassations', function (): void {
    $depot = fn (string $cle, string $date, int $montant) => comptaPoster($this->org, ecriture($cle, SourceType::Payment, $date, [
        LineData::debit(AccountRole::Bank, Money::EUR($montant)),
        LineData::credit(AccountRole::OwnerPayable, Money::EUR($montant), null, $this->mandant, $this->lot),
    ], journal: Journal::Bank));
    $depot('r-oct', '2026-10-15', 1000);
    $annulee = $depot('r-nov-1', '2026-11-03', 300);
    $depot('r-nov-2', '2026-11-10', 200);
    comptaDans($this->org, fn () => app(Ledger::class)->reverse($annulee->id, jour('2026-11-12')));
    $depot('r-dec', '2026-12-02', 50);

    $releve = comptaDans($this->org, fn () => app(LedgerAggregates::class)->partyStatement($this->mandant, AccountRole::OwnerPayable, $this->eur, jour('2026-11-01'), jour('2026-11-30')));

    expect($releve->opening->getAmount())->toBe('1000')
        ->and($releve->lines)->toHaveCount(3)
        ->and($releve->closing->getAmount())->toBe('1200')
        ->and($releve->lines[2]->isReversal)->toBeTrue()
        ->and($releve->lines[2]->source)->toBe(SourceType::Payment)
        ->and($releve->lines[2]->sourceId)->not->toBe('')
        ->and($releve->lines[0]->unitId)->toBe($this->lot)
        ->and($releve->lines[2]->balance->getAmount())->toBe('1200');
});

it('refuse un relevé de plus de 1000 lignes', function (): void {
    $lignes = [];

    foreach (range(1, 100) as $i) {
        $lignes[] = LineData::debit(AccountRole::Bank, Money::EUR(1));
        $lignes[] = LineData::credit(AccountRole::OwnerPayable, Money::EUR(1), null, $this->mandant);
    }

    foreach (range(1, 11) as $n) {
        comptaPoster($this->org, ecriture("long-{$n}", SourceType::Payment, '2026-11-03', $lignes, journal: Journal::Bank));
    }

    $lire = fn () => comptaDans($this->org, fn () => app(LedgerAggregates::class)->partyStatement($this->mandant, AccountRole::OwnerPayable, $this->eur, jour('2026-11-01'), jour('2026-11-30')));

    try {
        $lire();
        $code = 'aucune erreur';
    } catch (ApiProblem $probleme) {
        $code = $probleme->problemCode;
    }

    expect($code)->toBe('statement_too_long');
});

it('classe le reste dû par tranche d\'ancienneté et ignore les créances soldées', function (): void {
    $creance = function (string $cle, string $date, int $montant, ?int $paye = null) {
        $item = (string) Str::uuid7();
        comptaPoster($this->org, ecriture($cle, SourceType::Installment, $date, [
            LineData::debit(AccountRole::TenantReceivable, Money::EUR($montant), null, null, null, ItemType::Installment, $item),
            LineData::credit(AccountRole::RentRevenue, Money::EUR($montant)),
        ], $item));

        if ($paye !== null) {
            comptaPoster($this->org, ecriture("{$cle}-pay", SourceType::Payment, $date, [
                LineData::debit(AccountRole::Bank, Money::EUR($paye)),
                LineData::credit(AccountRole::TenantReceivable, Money::EUR($paye), null, null, null, ItemType::Installment, $item),
            ], journal: Journal::Bank));
        }
    };
    $creance('ag-0', '2026-11-20', 100);
    $creance('ag-30', '2026-10-31', 200);
    $creance('ag-31', '2026-10-30', 400);
    $creance('ag-60', '2026-10-01', 800, 300);
    $creance('ag-90', '2026-09-01', 1600);
    $creance('ag-old', '2026-01-05', 3200);
    $creance('ag-paid', '2026-02-05', 6400, 6400);

    $age = comptaDans($this->org, fn () => app(LedgerAggregates::class)->outstandingAging($this->eur, jour('2026-11-30')));
    $parCle = collect($age->buckets)->mapWithKeys(fn ($b) => [$b->key => [$b->amount->getAmount(), $b->count]])->all();

    expect(array_keys($parCle))->toBe(['0_30', '31_60', '61_90', 'over_90'])
        ->and($parCle['0_30'])->toBe(['300', 2])
        ->and($parCle['31_60'])->toBe(['900', 2])
        ->and($parCle['61_90'])->toBe(['1600', 1])
        ->and($parCle['over_90'])->toBe(['3200', 1])
        ->and($age->total->getAmount())->toBe('6000')
        ->and($age->count)->toBe(6);
});
