<?php

declare(strict_types=1);

use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateUnit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Feature\Mandates\MandatesContext as M;

beforeEach(function (): void {
    M::semer();
    $this->org = M::organisation();
    $this->lot = M::lot($this->org);
    $this->partie = M::partie($this->org);
    $this->travelTo(CarbonImmutable::parse('2026-11-16 10:00:00'));
    $this->actingAs(M::titulaire($this->org));
    $this->modifier = fn ($mandat, array $corps) => $this->patchJson(M::url($this->org, "/{$mandat->id}"), ['lock_version' => $mandat->lock_version, ...$corps]);
});

it('modifie un brouillon : dates, mandant, honoraires, lots, note', function (): void {
    $mandat = M::mandat($this->org, $this->lot, $this->partie);
    $autreLot = M::lot($this->org);
    $autre = M::partie($this->org);

    ($this->modifier)($mandat, [
        'mandant_party_id' => $autre->id,
        'starts_on' => '2026-02-01',
        'end_date' => '2028-01-31',
        'tacit_renewal' => true,
        'renewal_months' => 24,
        'notice_months' => 6,
        'note' => 'Reprise du mandat Bernard',
        'terms' => ['fee_kind' => 'flat', 'fee_flat_amount' => 9000, 'payout_day' => 12, 'works_limit_amount' => 20000, 'fee_base' => 'rent'],
        'units' => [['unit_id' => $autreLot->id]],
    ])
        ->assertOk()
        ->assertJsonPath('data.mandant.id', $autre->id)
        ->assertJsonPath('data.starts_on', '2026-02-01')
        ->assertJsonPath('data.end_date', '2028-01-31')
        ->assertJsonPath('data.tacit_renewal', true)
        ->assertJsonPath('data.renewal_months', 24)
        ->assertJsonPath('data.notice_months', 6)
        ->assertJsonPath('data.note', 'Reprise du mandat Bernard')
        ->assertJsonPath('data.terms.fee_kind', 'flat')
        ->assertJsonPath('data.terms.valid_from', '2026-02-01')
        ->assertJsonCount(1, 'data.units')
        ->assertJsonPath('data.units.0.unit.id', $autreLot->id)
        ->assertJsonPath('data.units.0.valid_from', '2026-02-01')
        ->assertJsonPath('data.lock_version', 2);

    M::dans($this->org, function () use ($mandat): void {
        expect(MandateTerm::query()->where('mandate_id', $mandat->id)->count())->toBe(1)
            ->and(MandateUnit::query()->where('mandate_id', $mandat->id)->count())->toBe(1);
    });
});

it('décale avec le début du mandat les lots et conditions posés ce jour-là', function (): void {
    $mandat = M::mandat($this->org, $this->lot, $this->partie);

    ($this->modifier)($mandat, ['starts_on' => '2026-03-01'])
        ->assertOk()
        ->assertJsonPath('data.units.0.valid_from', '2026-03-01')
        ->assertJsonPath('data.terms.valid_from', '2026-03-01');
});

it('change la devise du brouillon avec ses conditions', function (): void {
    $mandat = M::mandat($this->org, $this->lot, $this->partie);

    ($this->modifier)($mandat, ['currency' => 'XOF'])
        ->assertOk()
        ->assertJsonPath('data.currency', 'XOF')
        ->assertJsonPath('data.terms.works_limit_amount.currency', 'XOF');
});

it('refuse une version périmée, un mandat archivé ou des dates incohérentes', function (): void {
    $mandat = M::mandat($this->org, $this->lot, $this->partie);

    ($this->modifier)($mandat, ['lock_version' => 3, 'note' => 'x'])->assertConflict()->assertJsonPath('code', 'mandate_stale_version');
    ($this->modifier)($mandat, ['end_date' => '2025-12-31'])->assertUnprocessable()->assertJsonPath('code', 'mandate_period_invalid');
    ($this->modifier)($mandat, ['starts_on' => '2029-06-01'])->assertUnprocessable()->assertJsonPath('code', 'mandate_period_invalid');

    $archive = M::mandat($this->org, M::lot($this->org), $this->partie, ['archived_at' => now()]);
    ($this->modifier)($archive, ['note' => 'x'])->assertConflict()->assertJsonPath('code', 'mandate_archived');
});

it('ne modifie d\'un mandat actif que la note, les champs personnalisés et la reconduction', function (): void {
    $actif = M::actif($this->org, $this->lot, $this->partie);

    ($this->modifier)($actif, ['note' => 'Suivi', 'tacit_renewal' => true, 'renewal_months' => 6])
        ->assertOk()->assertJsonPath('data.note', 'Suivi')->assertJsonPath('data.tacit_renewal', true)->assertJsonPath('data.renewal_months', 6);

    foreach ([['starts_on' => '2026-02-01'], ['end_date' => '2030-01-01'], ['mandant_party_id' => $this->partie->id], ['currency' => 'XOF'],
        ['notice_months' => 1], ['terms' => ['fee_kind' => 'percentage', 'fee_basis_points' => 100, 'payout_day' => 5, 'fee_base' => 'rent']], ['units' => [['unit_id' => $this->lot->id]]]] as $corps) {
        ($this->modifier)(M::relire($this->org, $actif), $corps)->assertConflict()->assertJsonPath('code', 'mandate_not_draft');
    }
});

it('ne laisse pas le client modifier le statut, la signature ni l\'organisation', function (): void {
    $mandat = M::mandat($this->org, $this->lot, $this->partie);

    ($this->modifier)($mandat, ['note' => 'ok', 'status' => 'active', 'signed_on' => '2026-01-01', 'organization_id' => (string) Str::uuid7(), 'reference' => 'M-1-1'])->assertOk();

    $relu = M::relire($this->org, $mandat);
    expect($relu->status->value)->toBe('draft')->and($relu->signed_on)->toBeNull()->and($relu->organization_id)->toBe($this->org->id)->and($relu->reference)->toBe($mandat->reference);
});
