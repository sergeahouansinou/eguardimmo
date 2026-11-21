<?php

declare(strict_types=1);

use App\Modules\Tax\Models\TaxSummary;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Tax\TaxContext as T;

beforeEach(function (): void {
    T::preparer($this);
    $this->scene = T::bailleur2025($this);
    $this->org = $this->scene['org'];
    T::comme($this, $this->scene['owner']);
    $this->travelTo(CarbonImmutable::parse('2026-02-01 10:00:00'));
    $this->postJson(T::url($this->org, '/summaries'), ['income_year' => 2025], ['Idempotency-Key' => 'cle-verify-001'])->assertCreated();
});

it('tax:verify : une synthèse inchangée est conforme (code 0)', function (): void {
    $this->artisan('tax:verify')->expectsOutputToContain('conformes')->assertSuccessful();
});

it('tax:verify : une dépense saisie après figement est signalée, journalisée, et rien n\'est corrigé (code 1)', function (): void {
    T::depense($this, $this->scene, 'property_tax', 90000, ['paid_on' => '2025-12-20'])->assertCreated();
    $avant = L::dans($this->org, fn () => TaxSummary::query()->first()->fingerprint);

    $this->artisan('tax:verify')->expectsOutputToContain('tax_summary_differs_from_ledger')->assertFailed();

    expect(L::dans($this->org, fn () => TaxSummary::query()->count()))->toBe(1)
        ->and(L::dans($this->org, fn () => TaxSummary::query()->first()->fingerprint))->toBe($avant)
        ->and(DB::table('audit_logs')->where('action', 'tax.verify.anomaly')->count())->toBe(1);
});

it('tax:verify : une synthèse sans pièce émise est signalée incomplète', function (): void {
    DB::statement('DROP TRIGGER tax_summaries_figees');
    DB::table('tax_summaries')->update(['issued_document_id' => null]);

    $this->artisan('tax:verify')->expectsOutputToContain('tax_summary_incomplete')->assertFailed();
});
