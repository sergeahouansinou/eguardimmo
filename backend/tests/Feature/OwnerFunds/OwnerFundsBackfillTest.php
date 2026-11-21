<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\OwnerFunds\Events\TrustFundsGapDetected;
use App\Modules\Rent\Models\Installment;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Container\Container;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = F::agence($this, false);
    $this->ecritures = fn (): int => L::dans($this->org, fn () => JournalEntry::query()->count());
    $this->cutover = fn () => L::dans($this->org, fn () => app(LedgerReader::class)->ownerFundsCutoverAt());
});

it('à blanc par défaut : liste les reclassements sans écrire ni activer', function (): void {
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    $avant = ($this->ecritures)();

    $this->artisan('ownerfunds:backfill', ['organisation' => $this->org->id])->assertExitCode(0)->expectsOutputToContain('Aucune écriture passée');

    expect(($this->ecritures)())->toBe($avant)
        ->and(($this->cutover)())->toBeNull()
        ->and(L::dans($this->org, fn () => Installment::query()->whereNotNull('mandant_party_id')->count()))->toBe(0);
});

it('applique : produits reclassés en comptes appelés, encaissement versé au compte du mandant, activation posée', function (): void {
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    $installments = L::dans($this->org, fn () => Installment::query()->count());

    $this->artisan('ownerfunds:backfill', ['organisation' => $this->org->id, '--apply' => true, '--force' => true])->assertExitCode(0)->expectsOutputToContain('Fonds des mandants activés');

    expect(F::solde($this->org, AccountRole::RentRevenue))->toBe(0)
        ->and(F::solde($this->org, AccountRole::ChargesRecovered))->toBe(0)
        ->and(F::solde($this->org, AccountRole::OwnerRentCalled))->toBe(0)
        ->and(F::solde($this->org, AccountRole::OwnerPayable))->toBe(70000)
        ->and(F::solde($this->org, AccountRole::TrustBank))->toBe(0)
        ->and(($this->cutover)())->not->toBeNull()
        ->and(L::dans($this->org, fn () => Installment::query()->whereNotNull('mandant_party_id')->where('mandant_party_id', $this->mandant->id)->count()))->toBe($installments);
});

it('les écritures reprennent la date d\'origine et chaque écriture reste équilibrée', function (): void {
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    $this->artisan('ownerfunds:backfill', ['organisation' => $this->org->id, '--apply' => true, '--force' => true])->assertExitCode(0);

    $reclassements = L::dans($this->org, fn () => DB::table('journal_entries')->where('idempotency_key', 'like', 'owner_funds:backfill:%')->get());
    $collecte = $reclassements->first(fn ($e) => str_ends_with((string) $e->idempotency_key, ':collect'));
    $ecarts = L::dans($this->org, fn () => DB::table('journal_lines')->groupBy('journal_entry_id')->havingRaw('SUM(debit) <> SUM(credit)')->get()->count());

    expect($reclassements)->not->toBeEmpty()
        ->and(substr((string) $collecte->entry_date, 0, 10))->toBe('2026-11-16')
        ->and($ecarts)->toBe(0);
});

it('rejouable : un second passage n\'écrit rien de plus', function (): void {
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    $this->artisan('ownerfunds:backfill', ['organisation' => $this->org->id, '--apply' => true, '--force' => true])->assertExitCode(0);
    $apres = ($this->ecritures)();

    $this->artisan('ownerfunds:backfill', ['organisation' => $this->org->id, '--apply' => true, '--force' => true])->assertExitCode(0);

    expect(($this->ecritures)())->toBe($apres)->and(F::solde($this->org, AccountRole::OwnerPayable))->toBe(70000);
});

it('un encaissement partiel est ventilé au prorata, le reste appelé demeure', function (): void {
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 35000)->assertCreated();
    $this->artisan('ownerfunds:backfill', ['organisation' => $this->org->id, '--apply' => true, '--force' => true])->assertExitCode(0);

    expect(F::solde($this->org, AccountRole::OwnerPayable))->toBe(35000)
        ->and(F::solde($this->org, AccountRole::OwnerRentCalled))->toBe(32500)
        ->and(F::solde($this->org, AccountRole::OwnerChargesCalled))->toBe(2500);
});

it('une échéance sur un lot sans mandat reste non attribuée et n\'est jamais touchée', function (): void {
    ['bail' => $nu] = C::bail($this->org);
    C::emises($this->org, $nu, $this);
    $this->artisan('ownerfunds:backfill', ['organisation' => $this->org->id])->assertExitCode(0)->expectsOutputToContain('non attribuées');

    $this->artisan('ownerfunds:backfill', ['organisation' => $this->org->id, '--apply' => true, '--force' => true])->assertExitCode(0);

    expect(L::dans($this->org, fn () => Installment::query()->where('lease_id', $nu->id)->whereNotNull('mandate_id')->count()))->toBe(0)
        ->and(F::solde($this->org, AccountRole::RentRevenue))->toBeGreaterThan(0);
});

it('refusé dès qu\'un mois est clos : les écritures reprennent la date d\'origine', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $avant = ($this->ecritures)();

    $this->artisan('ownerfunds:backfill', ['organisation' => $this->org->id, '--apply' => true, '--force' => true])->assertExitCode(1)->expectsOutputToContain('première clôture');

    expect(($this->ecritures)())->toBe($avant)->and(($this->cutover)())->toBeNull();
});

it('l\'application est auditée sans montant', function (): void {
    C::emises($this->org, $this->bail, $this);
    $this->artisan('ownerfunds:backfill', ['organisation' => $this->org->id, '--apply' => true, '--force' => true])->assertExitCode(0);

    $audit = L::dans($this->org, fn () => DB::table('audit_logs')->where('action', 'ownerfunds.backfill.applied')->first());

    expect($audit)->not->toBeNull()->and(json_decode((string) $audit->metadata, true))->toHaveKeys(['installments', 'unmapped']);
});

it('ownerfunds:verify signale un écart de cantonnement, audite et notifie ; couvert, il se tait', function (): void {
    Event::fake([TrustFundsGapDetected::class]);
    C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    $this->artisan('ownerfunds:backfill', ['organisation' => $this->org->id, '--apply' => true, '--force' => true])->assertExitCode(0);

    $this->artisan('ownerfunds:verify')->assertExitCode(1)->expectsOutputToContain('Écart de cantonnement');
    Event::assertDispatched(TrustFundsGapDetected::class);
    expect(L::dans($this->org, fn () => DB::table('audit_logs')->where('action', 'ownerfunds.verify.anomaly')->count()))->toBe(1);

    $this->actingAs(L::titulaire($this->org));
    F::apporter($this, 70000, '2026-11-16');
    $this->artisan('ownerfunds:verify')->assertExitCode(0)->expectsOutputToContain('Cantonnement couvert');
});

it('ownerfunds:reconcile signale les échéances sous mandat non routées sans rien corriger', function (): void {
    C::emises($this->org, $this->bail, $this);
    L::dans($this->org, fn () => app(Container::class)->make(Ledger::class)->activateOwnerFunds(CarbonImmutable::parse('2026-01-01')));
    $avant = ($this->ecritures)();

    $this->artisan('ownerfunds:reconcile')->assertExitCode(1)->expectsOutputToContain('non routée');

    expect(($this->ecritures)())->toBe($avant);
});
