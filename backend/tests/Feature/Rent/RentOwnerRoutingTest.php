<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Rent\Models\Installment;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Money\Currency;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\Rent\RentContext as C;

function routageSolde(object $org, AccountRole $role): int
{
    return (int) L::dans($org, fn () => DB::table('journal_lines')->join('accounts', 'accounts.id', '=', 'journal_lines.account_id')
        ->where('accounts.role', $role->value)->selectRaw('COALESCE(SUM(journal_lines.credit - journal_lines.debit), 0) as s')->value('s'));
}

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    ['bail' => $this->bail, 'lot' => $this->lot] = C::bail($this->org);
    $this->mandant = L::dans($this->org, fn () => M::partie($this->org));
    M::actif($this->org, $this->lot, $this->mandant);
    $this->actingAs(L::titulaire($this->org));
});

it('sans date d\'activation, le loyer reste un produit de l\'agence et rien ne change', function (): void {
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();

    expect(routageSolde($this->org, AccountRole::RentRevenue))->toBe(65000)
        ->and(routageSolde($this->org, AccountRole::OwnerPayable))->toBe(0)
        ->and(routageSolde($this->org, AccountRole::TrustBank))->toBe(0);
});

it('active : l\'appel crédite les comptes appelés du mandant, l\'encaissement entre en banque de cantonnement et crée la dette envers le mandant', function (): void {
    L::dans($this->org, fn () => app(Ledger::class)->activateOwnerFunds(CarbonImmutable::parse('2026-01-01')));
    [$echeance] = C::emises($this->org, $this->bail, $this);

    expect($echeance->mandant_party_id)->toBe($this->mandant->id)
        ->and(routageSolde($this->org, AccountRole::OwnerRentCalled))->toBe(65000)
        ->and(routageSolde($this->org, AccountRole::OwnerChargesCalled))->toBe(5000)
        ->and(routageSolde($this->org, AccountRole::RentRevenue))->toBe(0);

    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();

    expect(routageSolde($this->org, AccountRole::OwnerRentCalled))->toBe(0)
        ->and(routageSolde($this->org, AccountRole::OwnerChargesCalled))->toBe(0)
        ->and(-routageSolde($this->org, AccountRole::TrustBank))->toBe(70000)
        ->and(routageSolde($this->org, AccountRole::OwnerPayable))->toBe(70000);

    $fonds = L::dans($this->org, fn () => app(LedgerAggregates::class)->ownerFunds([$this->mandant->id], new Currency('EUR')));
    expect($fonds[$this->mandant->id]->payable->getAmount())->toBe('70000');
});

it('un encaissement partiel est ventilé au prorata des composantes appelées, écart au dernier', function (): void {
    L::dans($this->org, fn () => app(Ledger::class)->activateOwnerFunds(CarbonImmutable::parse('2026-01-01')));
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 35000)->assertCreated();

    expect(routageSolde($this->org, AccountRole::OwnerRentCalled))->toBe(65000 - 32500)
        ->and(routageSolde($this->org, AccountRole::OwnerChargesCalled))->toBe(5000 - 2500)
        ->and(routageSolde($this->org, AccountRole::OwnerPayable))->toBe(35000);
});

it('l\'annulation de l\'encaissement recrée les appelés et solde la dette envers le mandant', function (): void {
    L::dans($this->org, fn () => app(Ledger::class)->activateOwnerFunds(CarbonImmutable::parse('2026-01-01')));
    C::emises($this->org, $this->bail, $this);
    $id = C::payer($this, $this->org, $this->bail, 70000)->assertCreated()->json('data.id');

    $this->postJson(C::url($this->org, "/payments/{$id}/cancel"), ['reason' => 'Chèque rejeté'])->assertOk();

    expect(routageSolde($this->org, AccountRole::OwnerPayable))->toBe(0)
        ->and(routageSolde($this->org, AccountRole::TrustBank))->toBe(0)
        ->and(routageSolde($this->org, AccountRole::OwnerRentCalled))->toBe(65000);
});

it('le routage est figé sur l\'échéance : un mandat ajouté après l\'avis ne la touche pas', function (): void {
    L::dans($this->org, fn () => app(Ledger::class)->activateOwnerFunds(CarbonImmutable::parse('2026-01-01')));
    [$echeance] = C::emises($this->org, $this->bail, $this);

    expect(fn () => L::dans($this->org, fn () => Installment::query()->whereKey($echeance->id)->update(['mandant_party_id' => null])))->toThrow(QueryException::class, 'fige');
});

it('chaque écriture reste équilibrée', function (): void {
    L::dans($this->org, fn () => app(Ledger::class)->activateOwnerFunds(CarbonImmutable::parse('2026-01-01')));
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 35000)->assertCreated();
    C::payer($this, $this->org, $this->bail, 40000)->assertCreated();

    $ecarts = L::dans($this->org, fn () => DB::table('journal_lines')
        ->groupBy('journal_entry_id')->havingRaw('SUM(debit) <> SUM(credit)')->get()->count());

    expect($ecarts)->toBe(0)
        ->and(L::dans($this->org, fn () => JournalEntry::query()->count()))->toBeGreaterThan(2);
});
