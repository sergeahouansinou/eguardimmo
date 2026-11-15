<?php

declare(strict_types=1);

require_once __DIR__.'/helpers.php';

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Currencies\ISOCurrencies;
use Money\Currency;
use Money\Money;

beforeEach(function (): void {
    $this->org = comptaOrganisation();
    $this->bail = (string) Str::uuid7();
    $this->partie = (string) Str::uuid7();
    $this->echeance1 = (string) Str::uuid7();
    $this->echeance2 = (string) Str::uuid7();
    $refs = fn (string $echeance): array => ['lease' => $this->bail, 'party' => $this->partie, 'item' => $echeance];

    comptaPoster($this->org, comptaLoyer('e:1', Money::EUR(100000), '2026-09-01', $refs($this->echeance1)));
    comptaPoster($this->org, comptaLoyer('e:2', Money::EUR(100000), '2026-10-01', $refs($this->echeance2)));
    comptaPoster($this->org, comptaPaiement('p:1', Money::EUR(60000), '2026-09-10', $refs($this->echeance1)));
    $this->lecture = fn (Closure $f): mixed => comptaDans($this->org, fn () => $f(app(LedgerReader::class)));
});

it('calcule le solde dû par bail et par partie, à une date', function (): void {
    $euro = new Currency('EUR');
    $solde = fn (string $methode, string $id, ?string $date = null): Money => ($this->lecture)(
        fn (LedgerReader $lecture) => $lecture->{$methode}($id, $euro, $date === null ? null : CarbonImmutable::parse($date)),
    );

    expect($solde('dueByLease', $this->bail)->equals(Money::EUR(140000)))->toBeTrue()
        ->and($solde('dueByParty', $this->partie)->equals(Money::EUR(140000)))->toBeTrue()
        ->and($solde('dueByLease', $this->bail, '2026-09-30')->equals(Money::EUR(40000)))->toBeTrue()
        ->and($solde('dueByLease', $this->bail, '2026-08-31')->equals(Money::EUR(0)))->toBeTrue()
        ->and($solde('dueByLease', $this->bail, '2026-09-10')->equals(Money::EUR(40000)))->toBeTrue()
        ->and($solde('dueByLease', (string) Str::uuid7())->equals(Money::EUR(0)))->toBeTrue()
        ->and(($this->lecture)(fn (LedgerReader $l) => $l->dueByLease($this->bail, new Currency('XOF')))->equals(Money::XOF(0)))->toBeTrue();
});

it('lit le reste dû d\'une créance dans le grand livre', function (): void {
    $euro = new Currency('EUR');

    expect(($this->lecture)(fn (LedgerReader $l) => $l->outstanding(ItemType::Installment, $this->echeance1, $euro))->equals(Money::EUR(40000)))->toBeTrue()
        ->and(($this->lecture)(fn (LedgerReader $l) => $l->outstanding(ItemType::Installment, $this->echeance2, $euro))->equals(Money::EUR(100000)))->toBeTrue()
        ->and(($this->lecture)(fn (LedgerReader $l) => $l->outstanding(ItemType::Invoice, $this->echeance2, $euro))->equals(Money::EUR(0)))->toBeTrue();

    comptaPoster($this->org, comptaPaiement('p:2', Money::EUR(50000), '2026-09-20', ['lease' => $this->bail, 'party' => $this->partie, 'item' => $this->echeance1]));

    expect(($this->lecture)(fn (LedgerReader $l) => $l->outstanding(ItemType::Installment, $this->echeance1, $euro))->equals(Money::EUR(-10000)))->toBeTrue();
});

it('lit le solde d\'un compte dans son sens normal', function (): void {
    $euro = new Currency('EUR');

    expect(($this->lecture)(fn (LedgerReader $l) => $l->accountBalance(AccountRole::Bank, $euro))->equals(Money::EUR(60000)))->toBeTrue()
        ->and(($this->lecture)(fn (LedgerReader $l) => $l->accountBalance(AccountRole::RentRevenue, $euro))->equals(Money::EUR(200000)))->toBeTrue()
        ->and(($this->lecture)(fn (LedgerReader $l) => $l->accountBalance(AccountRole::OwnerPayable, $euro))->equals(Money::EUR(0)))->toBeTrue()
        ->and(($this->lecture)(fn (LedgerReader $l) => $l->accountBalance(AccountRole::RentRevenue, $euro, CarbonImmutable::parse('2026-09-30')))->equals(Money::EUR(100000)))->toBeTrue();
});

it('édite l\'extrait du grand livre d\'un bail avec solde d\'ouverture et cumul', function (): void {
    $extrait = ($this->lecture)(fn (LedgerReader $l) => $l->leaseStatement($this->bail, new Currency('EUR'), CarbonImmutable::parse('2026-09-05'), CarbonImmutable::parse('2026-10-01')));

    expect($extrait->opening->equals(Money::EUR(100000)))->toBeTrue()
        ->and($extrait->lines)->toHaveCount(2)
        ->and($extrait->lines[0]->reference)->toBe('2026-000003')
        ->and($extrait->lines[0]->credit->equals(Money::EUR(60000)))->toBeTrue()
        ->and($extrait->lines[0]->balance->equals(Money::EUR(40000)))->toBeTrue()
        ->and($extrait->lines[1]->debit->equals(Money::EUR(100000)))->toBeTrue()
        ->and($extrait->closing->equals(Money::EUR(140000)))->toBeTrue();
});

it('n\'inclut pas dans l\'extrait la ligne du lendemain de la borne', function (): void {
    $extrait = ($this->lecture)(fn (LedgerReader $l) => $l->leaseStatement($this->bail, new Currency('EUR'), CarbonImmutable::parse('2026-09-01'), CarbonImmutable::parse('2026-09-30')));

    expect($extrait->lines)->toHaveCount(2)->and($extrait->closing->equals(Money::EUR(40000)))->toBeTrue();
});

it('stocke le XOF sans décimales et l\'EUR en centimes', function (): void {
    comptaPoster($this->org, comptaLoyer('x:1', Money::XOF(150000), '2026-11-02'));
    comptaPoster($this->org, comptaLoyer('x:2', Money::EUR(12345), '2026-11-03'));

    $xof = DB::table('journal_lines')->where('currency', 'XOF')->where('debit', '>', 0)->first();
    $eur = DB::table('journal_lines')->where('currency', 'EUR')->where('debit', 12345)->first();

    expect((int) $xof?->debit)->toBe(150000)
        ->and($eur)->not->toBeNull()
        ->and(($this->lecture)(fn (LedgerReader $l) => $l->accountBalance(AccountRole::RentRevenue, new Currency('XOF'))->equals(Money::XOF(150000))))->toBeTrue()
        ->and((new ISOCurrencies)->subunitFor(new Currency('XOF')))->toBe(0)
        ->and((new ISOCurrencies)->subunitFor(new Currency('EUR')))->toBe(2);
});

it('isole les organisations dans la PublicApi', function (): void {
    $autre = comptaOrganisation();
    $ecriture = comptaPoster($this->org, comptaLoyer('iso:1', Money::EUR(100), refs: ['lease' => $this->bail]));

    $depuisAutre = comptaDans($autre, fn () => [
        app(LedgerReader::class)->dueByLease($this->bail, new Currency('EUR')),
        app(LedgerReader::class)->accountBalance(AccountRole::RentRevenue, new Currency('EUR')),
        app(LedgerReader::class)->leaseStatement($this->bail, new Currency('EUR'), CarbonImmutable::parse('2026-01-01'), CarbonImmutable::parse('2026-12-31')),
    ]);

    expect($depuisAutre[0]->equals(Money::EUR(0)))->toBeTrue()
        ->and($depuisAutre[1]->equals(Money::EUR(0)))->toBeTrue()
        ->and($depuisAutre[2]->lines)->toBe([])
        ->and(fn () => comptaDans($autre, fn () => app(Ledger::class)->reverse($ecriture->id, CarbonImmutable::parse('2026-11-05'))))->toThrow(ApiProblem::class);
});
