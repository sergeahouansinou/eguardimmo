<?php

declare(strict_types=1);

use App\Modules\Mandates\Models\MandateTerm;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    Storage::fake('documents');
    M::semer();
    $this->org = M::organisation();
    $this->lot = M::lot($this->org);
    $this->partie = M::partie($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs(M::titulaire($this->org));
    $this->mandat = M::actif($this->org, $this->lot, $this->partie);
    $this->avenant = fn (array $corps, ?int $version = null) => $this->postJson(
        M::url($this->org, "/{$this->mandat->id}/terms"),
        ['lock_version' => $version ?? M::relire($this->org, $this->mandat)->lock_version, 'signed_file_id' => M::pieceSignee($this->org, $this->mandat), ...$corps],
    );
});

it('ferme les conditions en cours au jour d\'effet et en ouvre de nouvelles, en gardant l\'historique', function (): void {
    ($this->avenant)(['effective_on' => '2027-01-01', 'fee_basis_points' => 650, 'payout_day' => 10])
        ->assertOk()
        ->assertJsonPath('data.lock_version', 2)
        ->assertJsonCount(2, 'data.terms_history')
        ->assertJsonPath('data.terms_history.0.valid_to', '2027-01-01')
        ->assertJsonPath('data.terms_history.0.fee_basis_points', 700)
        ->assertJsonPath('data.terms_history.1.valid_from', '2027-01-01')
        ->assertJsonPath('data.terms_history.1.valid_to', null)
        ->assertJsonPath('data.terms_history.1.reason', 'amendment')
        ->assertJsonPath('data.terms_history.1.fee_basis_points', 650)
        ->assertJsonPath('data.terms_history.1.payout_day', 10)
        ->assertJsonPath('data.terms_history.1.works_limit_amount', ['amount' => 50000, 'currency' => 'EUR']);

    $courantes = M::dans($this->org, fn () => MandateTerm::query()->where('mandate_id', $this->mandat->id)->whereNull('valid_to')->firstOrFail());
    $ancienne = M::dans($this->org, fn () => MandateTerm::query()->where('mandate_id', $this->mandat->id)->whereNotNull('valid_to')->firstOrFail());

    expect($courantes->replaces_id)->toBe($ancienne->id);
});

it('les conditions du jour restent celles d\'avant l\'avenant tant qu\'il n\'a pas pris effet', function (): void {
    ($this->avenant)(['effective_on' => '2027-01-01', 'works_limit_amount' => 90000])
        ->assertOk()
        ->assertJsonPath('data.terms.works_limit_amount.amount', 50000);

    $this->travelTo(CarbonImmutable::parse('2027-01-01 08:00:00'));

    $this->getJson(M::url($this->org, "/{$this->mandat->id}"))->assertOk()->assertJsonPath('data.terms.works_limit_amount.amount', 90000);
});

it('passe d\'un taux à un forfait en exigeant le montant du forfait', function (): void {
    ($this->avenant)(['effective_on' => '2027-01-01', 'fee_kind' => 'flat'])->assertUnprocessable()->assertJsonPath('code', 'mandate_fee_invalid');
    ($this->avenant)(['effective_on' => '2027-01-01', 'fee_kind' => 'flat', 'fee_flat_amount' => 15000])
        ->assertOk()
        ->assertJsonPath('data.terms.fee_kind', 'percentage')
        ->assertJsonPath('data.terms_history.1.fee_kind', 'flat')
        ->assertJsonPath('data.terms_history.1.fee_basis_points', null)
        ->assertJsonPath('data.terms_history.1.fee_flat_amount.amount', 15000);
});

it('refuse un avenant dans le passé, après la fin, au même jour que les conditions en cours ou sans changement', function (): void {
    ($this->avenant)(['effective_on' => '2026-11-15', 'payout_day' => 3])->assertUnprocessable()->assertJsonValidationErrors('effective_on');
    ($this->avenant)(['effective_on' => '2029-01-01', 'payout_day' => 3])->assertUnprocessable()->assertJsonPath('code', 'mandate_period_invalid');
    ($this->avenant)(['effective_on' => '2026-11-16'])->assertUnprocessable()->assertJsonValidationErrors('fee_kind');
    ($this->avenant)(['effective_on' => '2026-11-16', 'payout_day' => 29])->assertUnprocessable()->assertJsonValidationErrors('payout_day');
    ($this->avenant)(['effective_on' => '2027-01-01', 'payout_day' => 3])->assertOk();
    ($this->avenant)(['effective_on' => '2026-12-01', 'payout_day' => 4])->assertConflict()->assertJsonPath('code', 'mandate_term_conflict');
    expect(M::dans($this->org, fn () => MandateTerm::query()->where('mandate_id', $this->mandat->id)->count()))->toBe(2);
});

it('refuse un avenant sur une version périmée, un brouillon ou un mandat archivé', function (): void {
    ($this->avenant)(['effective_on' => '2027-01-01', 'payout_day' => 3], 8)->assertConflict()->assertJsonPath('code', 'mandate_stale_version');

    $brouillon = M::mandat($this->org, M::lot($this->org), $this->partie);
    $this->postJson(M::url($this->org, "/{$brouillon->id}/terms"), ['lock_version' => 1, 'effective_on' => '2027-01-01', 'payout_day' => 3])
        ->assertConflict()->assertJsonPath('code', 'mandate_not_running');
    expect(M::dans($this->org, fn () => MandateTerm::query()->where('mandate_id', $this->mandat->id)->count()))->toBe(1);
});
