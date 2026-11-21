<?php

declare(strict_types=1);

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Money;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesContext as M;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

function mandantFinance(object $test, int $montant): string
{
    $partie = M::partie($test->org);
    L::dans($test->org, fn () => app(Ledger::class)->post(new EntryData(
        Journal::Bank, CarbonImmutable::parse('2026-11-15'), 'Loyer encaissé', SourceType::Payment, (string) Str::uuid7(), 'apercu-'.Str::random(8),
        [LineData::debit(AccountRole::TrustBank, Money::EUR($montant)), LineData::credit(AccountRole::OwnerPayable, Money::EUR($montant), null, $partie->id)],
    )));

    return $partie->id;
}

function nombreRequetes(Closure $appel): int
{
    DB::flushQueryLog();
    DB::enableQueryLog();
    $appel();
    $n = count(DB::getQueryLog());
    DB::disableQueryLog();

    return $n;
}

beforeEach(function (): void {
    ['org' => $this->org] = F::agence($this);
    $this->gros = mandantFinance($this, 90000);
    mandantFinance($this, 50000);
    mandantFinance($this, 10000);
});

it('l\'aperçu respecte la limite demandée, du plus gros solde au plus petit, et signale la troncature', function (): void {
    $reponse = $this->getJson(F::url($this->org, '/payouts/preview?limit=2'))->assertOk();

    expect($reponse->json('data'))->toHaveCount(2)
        ->and($reponse->json('data.0.mandant_party_id'))->toBe($this->gros)
        ->and($reponse->json('meta.limit'))->toBe(2)
        ->and($reponse->json('meta.truncated'))->toBeTrue();
    expect($this->getJson(F::url($this->org, '/payouts/preview?limit=10'))->json('meta.truncated'))->toBeFalse();
});

it('la limite par défaut vient de la configuration et ne dépasse jamais la taille d\'un lot', function (): void {
    config(['owner_funds.preview_limit' => 1]);

    expect($this->getJson(F::url($this->org, '/payouts/preview'))->assertOk()->json('data'))->toHaveCount(1);
    $this->getJson(F::url($this->org, '/payouts/preview?limit=0'))->assertStatus(422);
    $this->getJson(F::url($this->org, '/payouts/preview?limit='.((int) config('owner_funds.batch_max') + 1)))->assertStatus(422);
});

it('le coût d\'un aperçu est borné : le nombre de requêtes croît avec la limite, pas avec le nombre de mandants', function (): void {
    $un = nombreRequetes(fn () => $this->getJson(F::url($this->org, '/payouts/preview?limit=1'))->assertOk());
    $deux = nombreRequetes(fn () => $this->getJson(F::url($this->org, '/payouts/preview?limit=2'))->assertOk());
    $trois = nombreRequetes(fn () => $this->getJson(F::url($this->org, '/payouts/preview?limit=3'))->assertOk());

    expect($deux - $un)->toBe($trois - $deux)->and($deux - $un)->toBeLessThan(50);
    mandantFinance($this, 5000);
    expect(nombreRequetes(fn () => $this->getJson(F::url($this->org, '/payouts/preview?limit=3'))->assertOk()))->toBe($trois);
});
