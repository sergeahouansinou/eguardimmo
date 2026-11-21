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
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

function ecritureLibre(object $test, array $lignes): void
{
    L::dans($test->org, fn () => app(Ledger::class)->post(new EntryData(
        Journal::Bank, CarbonImmutable::parse('2026-12-10'), 'Écriture de contrôle', SourceType::TrustTransfer, (string) Str::uuid7(), 'verif-'.Str::random(8), $lignes,
    )));
}

function anomalies(object $test): int
{
    return L::dans($test->org, fn () => DB::table('audit_logs')->where('action', 'ownerfunds.verify.anomaly')->count());
}

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this);
    F::encaisserEtCloturer($this, $this->org, $this->bail);
});

it('un grand livre cohérent passe le contrôle quotidien', function (): void {
    F::lotValide($this);

    $this->artisan('ownerfunds:verify')->assertExitCode(0)->expectsOutputToContain('Cantonnement couvert');

    expect(anomalies($this))->toBe(0);
});

it('signale des reversements en transit qui ne valent pas la somme des lignes en attente', function (): void {
    F::lotValide($this);
    ecritureLibre($this, [LineData::debit(AccountRole::PayoutsInTransit, Money::EUR(100), null, $this->mandant->id), LineData::credit(AccountRole::TrustBank, Money::EUR(100))]);

    $this->artisan('ownerfunds:verify')->assertExitCode(1)->expectsOutputToContain('Reversements en transit incohérents');

    expect(anomalies($this))->toBe(1);
});

it('signale un compte mandant débiteur', function (): void {
    ecritureLibre($this, [LineData::debit(AccountRole::OwnerPayable, Money::EUR(80000), null, $this->mandant->id), LineData::credit(AccountRole::Bank, Money::EUR(80000))]);

    $this->artisan('ownerfunds:verify')->assertExitCode(1)->expectsOutputToContain('Compte mandant débiteur');

    expect(anomalies($this))->toBe(1);
});
